package com.bite_balance.app;

import android.content.Intent;
import android.util.Log;

import androidx.activity.result.ActivityResult;
import androidx.health.connect.client.HealthConnectClient;
import androidx.health.connect.client.PermissionController;
import androidx.health.connect.client.permission.HealthPermission;
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord;
import androidx.health.connect.client.records.StepsRecord;
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord;
import androidx.health.connect.client.request.ReadRecordsRequest;
import androidx.health.connect.client.response.ReadRecordsResponse;
import androidx.health.connect.client.time.TimeRangeFilter;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

import kotlin.coroutines.EmptyCoroutineContext;
import kotlin.jvm.JvmClassMappingKt;
import kotlinx.coroutines.BuildersKt;

// Health Connect reads that @capgo/capacitor-health can't do. Some watch apps (OHealth) write
// total calories burned but never active calories, so the app needs the total too.
@CapacitorPlugin(name = "HealthConnect")
public class HealthConnectPlugin extends Plugin {
    private static final String TAG = "HealthConnectPlugin";

    // Everything the app reads, asked for in one dialog: capgo's steps + active calories, plus total.
    private static final Set<String> PERMISSIONS = Set.of(
        HealthPermission.getReadPermission(JvmClassMappingKt.getKotlinClass(StepsRecord.class)),
        HealthPermission.getReadPermission(JvmClassMappingKt.getKotlinClass(ActiveCaloriesBurnedRecord.class)),
        HealthPermission.getReadPermission(JvmClassMappingKt.getKotlinClass(TotalCaloriesBurnedRecord.class))
    );

    private HealthConnectClient client() {
        if (HealthConnectClient.getSdkStatus(getContext()) != HealthConnectClient.SDK_AVAILABLE) return null;
        return HealthConnectClient.getOrCreate(getContext());
    }

    // Blocks the calling thread; only call from a background thread.
    private boolean granted() {
        HealthConnectClient c = client();
        if (c == null) return false;
        try {
            Set<String> granted = BuildersKt.runBlocking(EmptyCoroutineContext.INSTANCE,
                (scope, cont) -> c.getPermissionController().getGrantedPermissions(cont));
            return granted.containsAll(PERMISSIONS);
        } catch (Exception e) {
            Log.e(TAG, "Error checking permissions", e);
            return false;
        }
    }

    @PluginMethod
    public void hasAccess(PluginCall call) {
        new Thread(() -> call.resolve(new JSObject().put("granted", granted()))).start();
    }

    @PluginMethod
    public void requestAccess(PluginCall call) {
        if (client() == null) {
            call.resolve(new JSObject().put("granted", false));
            return;
        }
        Intent intent = PermissionController.createRequestPermissionResultContract()
            .createIntent(getContext(), PERMISSIONS);
        startActivityForResult(call, intent, "accessResult");
    }

    @ActivityCallback
    private void accessResult(PluginCall call, ActivityResult result) {
        new Thread(() -> call.resolve(new JSObject().put("granted", granted()))).start();
    }

    // Summed total-calorie records per local day for the last `days` days (today included); days
    // without records are left out. Raw records on purpose: Health Connect's ENERGY_TOTAL aggregate
    // pads unrecorded time with an estimated resting burn, which isn't what the watch measured.
    @PluginMethod
    public void getTotalCalories(PluginCall call) {
        int days = call.getInt("days", 30);
        new Thread(() -> {
            HealthConnectClient c = client();
            JSArray out = new JSArray();
            if (c == null) {
                call.resolve(new JSObject().put("days", out));
                return;
            }
            try {
                TimeRangeFilter range = TimeRangeFilter.between(LocalDate.now().minusDays(days - 1).atStartOfDay(), LocalDateTime.now());
                Map<String, Double> byDay = new TreeMap<>();
                String pageToken = null;
                do {
                    ReadRecordsRequest<TotalCaloriesBurnedRecord> request = new ReadRecordsRequest<>(
                        JvmClassMappingKt.getKotlinClass(TotalCaloriesBurnedRecord.class), range, Set.of(), true, 1000, pageToken);
                    ReadRecordsResponse<TotalCaloriesBurnedRecord> response = BuildersKt.runBlocking(EmptyCoroutineContext.INSTANCE,
                        (scope, cont) -> c.readRecords(request, cont));
                    for (TotalCaloriesBurnedRecord r : response.getRecords()) {
                        String day = r.getStartTime().atZone(ZoneId.systemDefault()).toLocalDate().toString();
                        byDay.merge(day, r.getEnergy().getKilocalories(), Double::sum);
                    }
                    pageToken = response.getPageToken();
                } while (pageToken != null);
                for (Map.Entry<String, Double> day : byDay.entrySet()) {
                    out.put(new JSObject().put("date", day.getKey()).put("kcal", day.getValue()));
                }
                call.resolve(new JSObject().put("days", out));
            } catch (Exception e) {
                Log.e(TAG, "Error reading total calories", e);
                call.reject("Failed to read total calories", e);
            }
        }).start();
    }
}
