
package com.bite_balance.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
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
    
    private HealthConnectClient healthConnectClient;
    private final Executor executor = Executors.newSingleThreadExecutor();
    
    @Override
    public void load() {
        super.load();
        Context context = getContext();
        
        if (HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE) {
            healthConnectClient = HealthConnectClient.getOrCreate(context);
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        Context context = getContext();
        JSObject ret = new JSObject();
        
        try {
            int sdkStatus = HealthConnectClient.getSdkStatus(context);
            boolean available = sdkStatus == HealthConnectClient.SDK_AVAILABLE;
            
            ret.put("available", available);
            ret.put("status", sdkStatus);
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("available", false);
            ret.put("status", -1);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (healthConnectClient == null) {
            JSObject ret = new JSObject();
            ret.put("granted", false);
            call.resolve(ret);
            return;
        }

        Set<String> permissions = new HashSet<>();
        permissions.add(HealthPermission.getReadPermission(StepsRecord.class));
        permissions.add(HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord.class));
        permissions.add(HealthPermission.getReadPermission(TotalCaloriesBurnedRecord.class));

        executor.execute(() -> {
            try {
                Intent permissionIntent = PermissionController.createRequestPermissionResultContract()
                    .createIntent(getContext(), permissions);
                
                startActivityForResult(call, permissionIntent, "healthConnectPermission");
            } catch (Exception e) {
                JSObject ret = new JSObject();
                ret.put("granted", false);
                call.resolve(ret);
            }
        });
    }

    @PluginMethod
    public void getTodaysSteps(PluginCall call) {
        if (healthConnectClient == null) {
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

                healthConnectClient.readRecords(request).addOnSuccessListener(response -> {
                    long totalSteps = 0;
                    for (StepsRecord record : response.getRecords()) {
                        totalSteps += record.getCount();
                    }
                    
                    JSObject ret = new JSObject();
                    ret.put("steps", totalSteps);
                    ret.put("date", startOfDay.format(DateTimeFormatter.ISO_LOCAL_DATE));
                    call.resolve(ret);
                }).addOnFailureListener(exception -> {
                    call.reject("Failed to read steps data: " + exception.getMessage());
                });
                
            } catch (Exception e) {
                call.reject("Error reading steps: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void getTodaysCalories(PluginCall call) {
        if (healthConnectClient == null) {
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
                
                // Read active calories
                ReadRecordsRequest<ActiveCaloriesBurnedRecord> activeRequest = 
                    new ReadRecordsRequest.Builder<>(ActiveCaloriesBurnedRecord.class)
                        .setTimeRangeFilter(timeRangeFilter)
                        .build();

                // Read total calories
                ReadRecordsRequest<TotalCaloriesBurnedRecord> totalRequest = 
                    new ReadRecordsRequest.Builder<>(TotalCaloriesBurnedRecord.class)
                        .setTimeRangeFilter(timeRangeFilter)
                        .build();

                healthConnectClient.readRecords(activeRequest).addOnSuccessListener(activeResponse -> {
                    double totalActiveCalories = 0;
                    for (ActiveCaloriesBurnedRecord record : activeResponse.getRecords()) {
                        totalActiveCalories += record.getEnergy().getKilocalories();
                    }
                    
                    healthConnectClient.readRecords(totalRequest).addOnSuccessListener(totalResponse -> {
                        double totalCalories = 0;
                        for (TotalCaloriesBurnedRecord record : totalResponse.getRecords()) {
                            totalCalories += record.getEnergy().getKilocalories();
                        }
                        
                        JSObject ret = new JSObject();
                        ret.put("activeCalories", totalActiveCalories);
                        ret.put("totalCalories", totalCalories);
                        ret.put("date", startOfDay.format(DateTimeFormatter.ISO_LOCAL_DATE));
                        call.resolve(ret);
                    }).addOnFailureListener(exception -> {
                        call.reject("Failed to read total calories: " + exception.getMessage());
                    });
                    
                }).addOnFailureListener(exception -> {
                    call.reject("Failed to read active calories: " + exception.getMessage());
                });
                
            } catch (Exception e) {
                call.reject("Error reading calories: " + e.getMessage());
            }
        });
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        
        PluginCall savedCall = getSavedCall();
        if (savedCall == null) {
            return;
        }

        JSObject ret = new JSObject();
        ret.put("granted", resultCode == getActivity().RESULT_OK);
        savedCall.resolve(ret);
    }
}
