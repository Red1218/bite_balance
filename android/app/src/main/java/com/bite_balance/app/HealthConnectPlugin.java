
package com.bite_balance.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;
import androidx.health.connect.client.HealthConnectClient;
import androidx.health.connect.client.PermissionController;
import androidx.health.connect.client.permission.HealthPermission;
import androidx.health.connect.client.records.StepsRecord;
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord;
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord;
import androidx.health.connect.client.request.ReadRecordsRequest;
import androidx.health.connect.client.time.TimeRangeFilter;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Set;
import java.util.HashSet;
import java.util.List;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "HealthConnect")
public class HealthConnectPlugin extends Plugin {
    
    private static final String TAG = "HealthConnectPlugin";
    private HealthConnectClient healthConnectClient;
    private final Executor executor = Executors.newSingleThreadExecutor();
    
    @Override
    public void load() {
        super.load();
        Context context = getContext();
        
        Log.d(TAG, "Loading HealthConnect plugin...");
        
        try {
            int sdkStatus = HealthConnectClient.getSdkStatus(context);
            Log.d(TAG, "Health Connect SDK Status: " + sdkStatus);
            
            if (sdkStatus == HealthConnectClient.SDK_AVAILABLE) {
                healthConnectClient = HealthConnectClient.getOrCreate(context);
                Log.d(TAG, "HealthConnect client created successfully");
            } else {
                Log.w(TAG, "Health Connect SDK not available. Status: " + sdkStatus);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error initializing Health Connect: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        Context context = getContext();
        JSObject ret = new JSObject();
        
        try {
            int sdkStatus = HealthConnectClient.getSdkStatus(context);
            boolean available = sdkStatus == HealthConnectClient.SDK_AVAILABLE;
            
            Log.d(TAG, "Checking availability - SDK Status: " + sdkStatus + ", Available: " + available);
            
            ret.put("available", available);
            ret.put("status", sdkStatus);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error checking availability: " + e.getMessage(), e);
            ret.put("available", false);
            ret.put("status", -1);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        Log.d(TAG, "Requesting permissions...");
        
        if (healthConnectClient == null) {
            Log.e(TAG, "HealthConnect client is null");
            JSObject ret = new JSObject();
            ret.put("granted", false);
            ret.put("error", "Health Connect client not initialized");
            call.resolve(ret);
            return;
        }

        Set<String> permissions = new HashSet<>();
        permissions.add(HealthPermission.getReadPermission(StepsRecord.class));
        permissions.add(HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord.class));
        permissions.add(HealthPermission.getReadPermission(TotalCaloriesBurnedRecord.class));

        Log.d(TAG, "Requesting permissions: " + permissions.toString());

        executor.execute(() -> {
            try {
                // Check if permissions are already granted
                healthConnectClient.getGrantedPermissions().addOnSuccessListener(grantedPermissions -> {
                    Log.d(TAG, "Already granted permissions: " + grantedPermissions.toString());
                    
                    boolean allGranted = grantedPermissions.containsAll(permissions);
                    if (allGranted) {
                        Log.d(TAG, "All permissions already granted");
                        JSObject ret = new JSObject();
                        ret.put("granted", true);
                        call.resolve(ret);
                        return;
                    }
                    
                    // Request missing permissions
                    try {
                        Intent permissionIntent = PermissionController.createRequestPermissionResultContract()
                            .createIntent(getContext(), permissions);
                        
                        Log.d(TAG, "Starting permission request activity");
                        startActivityForResult(call, permissionIntent, "healthConnectPermission");
                    } catch (Exception e) {
                        Log.e(TAG, "Error creating permission intent: " + e.getMessage(), e);
                        JSObject ret = new JSObject();
                        ret.put("granted", false);
                        ret.put("error", e.getMessage());
                        call.resolve(ret);
                    }
                }).addOnFailureListener(exception -> {
                    Log.e(TAG, "Error checking granted permissions: " + exception.getMessage(), exception);
                    JSObject ret = new JSObject();
                    ret.put("granted", false);
                    ret.put("error", exception.getMessage());
                    call.resolve(ret);
                });
            } catch (Exception e) {
                Log.e(TAG, "Error in permission request: " + e.getMessage(), e);
                JSObject ret = new JSObject();
                ret.put("granted", false);
                ret.put("error", e.getMessage());
                call.resolve(ret);
            }
        });
    }

    @PluginMethod
    public void getTodaysSteps(PluginCall call) {
        Log.d(TAG, "Getting today's steps...");
        
        if (healthConnectClient == null) {
            Log.e(TAG, "HealthConnect client is null");
            call.reject("Health Connect not available");
            return;
        }

        executor.execute(() -> {
            try {
                LocalDateTime startOfDay = LocalDateTime.now().withHour(0).withMinute(0).withSecond(0).withNano(0);
                LocalDateTime endOfDay = startOfDay.plusDays(1);
                
                Instant startInstant = startOfDay.atZone(ZoneId.systemDefault()).toInstant();
                Instant endInstant = endOfDay.atZone(ZoneId.systemDefault()).toInstant();
                
                TimeRangeFilter timeRangeFilter = TimeRangeFilter.between(startInstant, endInstant);
                
                ReadRecordsRequest<StepsRecord> request = new ReadRecordsRequest.Builder<>(StepsRecord.class)
                    .setTimeRangeFilter(timeRangeFilter)
                    .build();

                Log.d(TAG, "Reading steps records from " + startInstant + " to " + endInstant);

                healthConnectClient.readRecords(request).addOnSuccessListener(response -> {
                    long totalSteps = 0;
                    List<StepsRecord> records = response.getRecords();
                    
                    Log.d(TAG, "Found " + records.size() + " steps records");
                    
                    for (StepsRecord record : records) {
                        totalSteps += record.getCount();
                        Log.d(TAG, "Steps record: " + record.getCount() + " from " + record.getStartTime());
                    }
                    
                    Log.d(TAG, "Total steps: " + totalSteps);
                    
                    JSObject ret = new JSObject();
                    ret.put("steps", totalSteps);
                    ret.put("date", startOfDay.format(DateTimeFormatter.ISO_LOCAL_DATE));
                    call.resolve(ret);
                }).addOnFailureListener(exception -> {
                    Log.e(TAG, "Failed to read steps data: " + exception.getMessage(), exception);
                    call.reject("Failed to read steps data: " + exception.getMessage());
                });
                
            } catch (Exception e) {
                Log.e(TAG, "Error reading steps: " + e.getMessage(), e);
                call.reject("Error reading steps: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void getTodaysCalories(PluginCall call) {
        Log.d(TAG, "Getting today's calories...");
        
        if (healthConnectClient == null) {
            Log.e(TAG, "HealthConnect client is null");
            call.reject("Health Connect not available");
            return;
        }

        executor.execute(() -> {
            try {
                LocalDateTime startOfDay = LocalDateTime.now().withHour(0).withMinute(0).withSecond(0).withNano(0);
                LocalDateTime endOfDay = startOfDay.plusDays(1);
                
                Instant startInstant = startOfDay.atZone(ZoneId.systemDefault()).toInstant();
                Instant endInstant = endOfDay.atZone(ZoneId.systemDefault()).toInstant();
                
                TimeRangeFilter timeRangeFilter = TimeRangeFilter.between(startInstant, endInstant);
                
                ReadRecordsRequest<ActiveCaloriesBurnedRecord> activeRequest = 
                    new ReadRecordsRequest.Builder<>(ActiveCaloriesBurnedRecord.class)
                        .setTimeRangeFilter(timeRangeFilter)
                        .build();

                ReadRecordsRequest<TotalCaloriesBurnedRecord> totalRequest = 
                    new ReadRecordsRequest.Builder<>(TotalCaloriesBurnedRecord.class)
                        .setTimeRangeFilter(timeRangeFilter)
                        .build();

                Log.d(TAG, "Reading calories records from " + startInstant + " to " + endInstant);

                healthConnectClient.readRecords(activeRequest).addOnSuccessListener(activeResponse -> {
                    double totalActiveCalories = 0;
                    List<ActiveCaloriesBurnedRecord> activeRecords = activeResponse.getRecords();
                    
                    Log.d(TAG, "Found " + activeRecords.size() + " active calories records");
                    
                    for (ActiveCaloriesBurnedRecord record : activeRecords) {
                        totalActiveCalories += record.getEnergy().getKilocalories();
                    }
                    
                    healthConnectClient.readRecords(totalRequest).addOnSuccessListener(totalResponse -> {
                        double totalCalories = 0;
                        List<TotalCaloriesBurnedRecord> totalRecords = totalResponse.getRecords();
                        
                        Log.d(TAG, "Found " + totalRecords.size() + " total calories records");
                        
                        for (TotalCaloriesBurnedRecord record : totalRecords) {
                            totalCalories += record.getEnergy().getKilocalories();
                        }
                        
                        Log.d(TAG, "Active calories: " + totalActiveCalories + ", Total calories: " + totalCalories);
                        
                        JSObject ret = new JSObject();
                        ret.put("activeCalories", totalActiveCalories);
                        ret.put("totalCalories", totalCalories);
                        ret.put("date", startOfDay.format(DateTimeFormatter.ISO_LOCAL_DATE));
                        call.resolve(ret);
                    }).addOnFailureListener(exception -> {
                        Log.e(TAG, "Failed to read total calories: " + exception.getMessage(), exception);
                        call.reject("Failed to read total calories: " + exception.getMessage());
                    });
                    
                }).addOnFailureListener(exception -> {
                    Log.e(TAG, "Failed to read active calories: " + exception.getMessage(), exception);
                    call.reject("Failed to read active calories: " + exception.getMessage());
                });
                
            } catch (Exception e) {
                Log.e(TAG, "Error reading calories: " + e.getMessage(), e);
                call.reject("Error reading calories: " + e.getMessage());
            }
        });
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        
        Log.d(TAG, "Permission result - Request code: " + requestCode + ", Result code: " + resultCode);
        
        PluginCall savedCall = getSavedCall();
        if (savedCall == null) {
            Log.w(TAG, "No saved call found for permission result");
            return;
        }

        JSObject ret = new JSObject();
        boolean granted = resultCode == getActivity().RESULT_OK;
        ret.put("granted", granted);
        
        Log.d(TAG, "Permissions granted: " + granted);
        savedCall.resolve(ret);
    }
}
