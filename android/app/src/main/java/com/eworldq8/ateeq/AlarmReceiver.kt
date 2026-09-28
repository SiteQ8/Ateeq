package com.eworldq8.ateeq

import android.Manifest
import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import org.json.JSONArray

/** The plane alert: "get ready" and "time to enter ihram", scheduled on the phone itself. */
object Alarms {
    const val CHANNEL = "ihram"
    private val ids = listOf("prepare", "intent")

    fun schedule(context: Context, items: JSONArray) {
        clear(context)
        ensureChannel(context)
        val alarms = context.getSystemService(AlarmManager::class.java) ?: return
        for (i in 0 until items.length()) {
            val item = items.optJSONObject(i) ?: continue
            val id = item.optString("id")
            val at = item.optDouble("at", 0.0).toLong()
            if (id !in ids || at <= System.currentTimeMillis() + 1000) continue
            // Allowed while the phone idles on the plane, and needs no special alarm permission.
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending(context, id, item.optString("title"), item.optString("body")))
        }
    }

    fun clear(context: Context) {
        val alarms = context.getSystemService(AlarmManager::class.java) ?: return
        ids.forEach { alarms.cancel(pending(context, it, "", "")) }
    }

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < 26) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        if (manager.getNotificationChannel(CHANNEL) == null) {
            val channel = NotificationChannel(CHANNEL, context.getString(R.string.channel_name), NotificationManager.IMPORTANCE_HIGH)
            channel.description = context.getString(R.string.channel_description)
            manager.createNotificationChannel(channel)
        }
    }

    private fun pending(context: Context, id: String, title: String, body: String): PendingIntent {
        val intent = Intent(context, AlarmReceiver::class.java)
            .setAction("com.eworldq8.ateeq.ALARM.$id")
            .putExtra("title", title)
            .putExtra("body", body)
        return PendingIntent.getBroadcast(context, ids.indexOf(id), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
}

class AlarmReceiver : BroadcastReceiver() {
    @SuppressLint("MissingPermission")
    override fun onReceive(context: Context, intent: Intent) {
        Alarms.ensureChannel(context)
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        val open = PendingIntent.getActivity(
            context, 0,
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val title = intent.getStringExtra("title").orEmpty()
        val body = intent.getStringExtra("body").orEmpty()
        val note = NotificationCompat.Builder(context, Alarms.CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(ContextCompat.getColor(context, R.color.gold))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(open)
            .build()
        NotificationManagerCompat.from(context).notify((intent.action ?: "ateeq").hashCode(), note)
    }
}
