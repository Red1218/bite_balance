
package com.bite_balance.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
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
import java.time.temporal.ChronoUnit;
import java.util.Set;
import java.util.concurrent.CompletableFuture;

@CapacitorPlugin(name = "HealthConnect")
public class HealthConnectPlugin extends Plugin {

    private HealthConnectClient healthConnectClient;
    private final Set<String> PERMISSIONS = Set.of(
        HealthPermission.getReadPermission(StepsRecord.class),
        HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord.class),
        HealthPermission.getReadPermission(TotalCaloriesBurnedRecord.class)
    );

    @Override
    public void load() {
        Context context = getContext();
        if (HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE) {
            healthConnectClient = HealthConnectClient.getOrCreate(context);
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        Context context = getContext();
        int sdkStatus = HealthConnectClient.getSdkStatus(context);
        
        JSObject result = new JSObject();
        result.put("available", sdkStatus == HealthConnectClient.SDK_AVAILABLE);
        result.put("status", sdkStatus);
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (healthConnectClient == null) {
            call.reject("Health Connect not available");
            return;
        }

        CompletableFuture<Set<String>> future = healthConnectClient.getPermissionController()
            .getGrantedPermissions(PERMISSIONS);
        
        future.whenComplete((grantedPermissions, throwable) -> {
            if (throwable != null) {
                call.reject("Failed to check permissions: " + throwable.getMessage());
                return;
            }

            if (grantedPermissions.containsAll(PERMISSIONS)) {
                JSObject result = new JSObject();
                result.put("granted", true);
                call.resolve(result);
            } else {
                // Launch permission request
                try {
                    Intent intent = PermissionController.createRequestPermissionResultContract()
                        .createIntent(getContext(), PERMISSIONS);
                    startActivityForResult(call, intent, "permissionResult");
                } catch (Exception e) {
                    call.reject("Failed to request permissions: " + e.getMessage());
                }
            }
        });
    }

    @PluginMethod
    public void getTodaysSteps(PluginCall call) {
        if (healthConnectClient == null) {
            call.reject("Health Connect not available");
            return;
        }

        LocalDateTime startTime = LocalDateTime.now().withHour(0).withMinute(0).withSecond(0);
        LocalDateTime endTime = LocalDateTime.now();
        
        TimeRangeFilter timeRangeFilter = new TimeRangeFilter.Builder()
            .setStartTime(startTime.atZone(ZoneId.systemDefault()).toInstant())
            .setEndTime(endTime.atZone(ZoneId.systemDefault()).toInstant())
            .build();

        ReadRecordsRequest<StepsRecord> request = new ReadRecordsRequest.Builder<>(StepsRecord.class)
            .setTimeRangeFilter(timeRangeFilter)
            .build();

        CompletableFuture<ReadRecordsRequest.Result<StepsRecord>> future = 
            healthConnectClient.readRecords(request);
        
        future.whenComplete((result, throwable) -> {
            if (throwable != null) {
                call.reject("Failed to read steps: " + throwable.getMessage());
                return;
            }

            long totalSteps = result.getRecords().stream()
                .mapToLong(StepsRecord::getCount)
                .sum();

            JSObject response = new JSObject();
            response.put("steps", totalSteps);
            response.put("date", startTime.toLocalDate().toString());
            call.resolve(response);
        });
    }

    @PluginMethod
    public void getTodaysCalories(PluginCall call) {
        if (healthConnectClient == null) {
            call.reject("Health Connect not available");
            return;
        }

        LocalDateTime startTime = LocalDateTime.now().withHour(0).withMinute(0).withSecond(0);
        LocalDateTime endTime = LocalDateTime.now();
        
        TimeRangeFilter timeRangeFilter = new TimeRangeFilter.Builder()
            .setStartTime(startTime.atZone(ZoneId.systemDefault()).toInstant())
            .setEndTime(endTime.atZone(ZoneId.systemDefault()).toInstant())
            .build();

        ReadRecordsRequest<ActiveCaloriesBurnedRecord> activeRequest = 
            new ReadRecordsRequest.Builder<>(ActiveCaloriesBurnedRecord.class)
                .setTimeRangeFilter(timeRangeFilter)
                .build();

        ReadRecordsRequest<TotalCaloriesBurnedRecord> totalRequest = 
            new ReadRecordsRequest.Builder<>(TotalCaloriesBurnedRecord.class)
                .setTimeRangeFilter(timeRangeFilter)
                .build();

        CompletableFuture<ReadRecordsRequest.Result<ActiveCaloriesBurnedRecord>> activeFuture = 
            healthConnectClient.readRecords(activeRequest);
        
        CompletableFuture<ReadRecordsRequest.Result<TotalCaloriesBurnedRecord>> totalFuture = 
            healthConnectClient.readRecords(totalRequest);

        CompletableFuture.allOf(activeFuture, totalFuture).whenComplete((void_result, throwable) -> {
            if (throwable != null) {
                call.reject("Failed to read calories: " + throwable.getMessage());
                return;
            }

            try {
                double activeCalories = activeFuture.get().getRecords().stream()
                    .mapToDouble(record -> record.getEnergy().getKilocalories())
                    .sum();

                double totalCalories = totalFuture.get().getRecords().stream()
                    .mapToDouble(record -> record.getEnergy().getKilocalories())
                    .sum();

                JSObject response = new JSObject();
                response.put("activeCalories", activeCalories);
                response.put("totalCalories", totalCalories);
                response.put("date", startTime.toLocalDate().toString());
                call.resolve(response);
            } catch (Exception e) {
                call.reject("Failed to process calories data: " + e.getMessage());
            }
        });
    }
}
