# R8 rules for the Haguruma release build.
# Capacitor ships consumer rules in its AAR; these cover the bridge entry
# points that are only reached through reflection or the WebView.

# Capacitor plugins and bridge (annotation-driven reflection).
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public <methods>;
    @android.webkit.JavascriptInterface <methods>;
}

# App entry point.
-keep class com.haguruma.app.MainActivity { *; }

# Keep line numbers for readable crash traces, hide source file names.
-keepattributes SourceFile,LineNumberTable,*Annotation*
-renamesourcefileattribute SourceFile
