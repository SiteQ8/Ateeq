# The page calls these methods by name through the WebView bridge (window.AteeqAndroid),
# and WebView only exposes methods that still carry the @JavascriptInterface annotation.
-keepattributes RuntimeVisibleAnnotations,AnnotationDefault,Signature,InnerClasses,EnclosingMethod
-keepclassmembers class com.eworldq8.ateeq.MainActivity$Bridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
