package com.cogapp.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends BridgeActivity {
    private static final int CAMERA_PERMISSION_REQUEST_CODE = 1001;

    public class WebAppInterface {
        @JavascriptInterface
        public void openAppSettings() {
            try {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                Uri uri = Uri.fromParts("package", getPackageName(), null);
                intent.setData(uri);
                startActivity(intent);
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public void requestCameraPermission() {
            try {
                if (ContextCompat.checkSelfPermission(MainActivity.this,
                        Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(MainActivity.this, new String[] { Manifest.permission.CAMERA },
                            CAMERA_PERMISSION_REQUEST_CODE);
                }
            } catch (Exception ignored) {
            }
        }

        /**
         * Saves a base64 encoded file directly to the device's public storage.
         * Images (PNG, JPG, etc.) -> Pictures/COG
         * Documents (Excel, CSV, PDF, etc.) -> Download
         */
        @JavascriptInterface
        public boolean saveBase64File(String base64Data, String fileName, String mimeType) {
            try {
                if (base64Data == null || fileName == null) {
                    return false;
                }

                // Strip data URL scheme prefix if present (e.g. data:image/png;base64,...)
                String cleanBase64 = base64Data;
                int commaIdx = cleanBase64.indexOf(",");
                if (commaIdx != -1) {
                    cleanBase64 = cleanBase64.substring(commaIdx + 1);
                }
                cleanBase64 = cleanBase64.replaceAll("\\s+", "");

                byte[] fileBytes = Base64.decode(cleanBase64, Base64.DEFAULT);
                if (fileBytes == null || fileBytes.length == 0) {
                    return false;
                }

                boolean isImage = (mimeType != null && mimeType.startsWith("image/"))
                        || fileName.endsWith(".png")
                        || fileName.endsWith(".jpg")
                        || fileName.endsWith(".jpeg");

                boolean success = false;

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    // Android 10+ (API 29+) MediaStore scoped storage
                    ContentResolver resolver = getContentResolver();
                    ContentValues contentValues = new ContentValues();
                    contentValues.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                    contentValues.put(MediaStore.MediaColumns.MIME_TYPE, mimeType != null ? mimeType : (isImage ? "image/png" : "application/octet-stream"));

                    Uri collectionUri;
                    if (isImage) {
                        contentValues.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/COG");
                        collectionUri = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
                    } else {
                        contentValues.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                        collectionUri = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
                    }

                    Uri fileUri = resolver.insert(collectionUri, contentValues);
                    if (fileUri != null) {
                        try (OutputStream outputStream = resolver.openOutputStream(fileUri)) {
                            if (outputStream != null) {
                                outputStream.write(fileBytes);
                                outputStream.flush();
                                success = true;
                            }
                        }
                    }
                } else {
                    // Legacy Android 9 and below
                    File targetDir = isImage
                            ? new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "COG")
                            : Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);

                    if (!targetDir.exists()) {
                        targetDir.mkdirs();
                    }

                    File file = new File(targetDir, fileName);
                    try (FileOutputStream fos = new FileOutputStream(file)) {
                        fos.write(fileBytes);
                        fos.flush();
                        success = true;
                    }

                    // Scan file so it shows in Gallery / Downloads app
                    Intent mediaScanIntent = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
                    mediaScanIntent.setData(Uri.fromFile(file));
                    sendBroadcast(mediaScanIntent);
                }

                final boolean finalSuccess = success;
                final String finalMsg = success
                        ? (isImage ? "Saved to Pictures/COG (" + fileName + ")" : "Saved to Downloads (" + fileName + ")")
                        : "Failed to save file";

                runOnUiThread(() -> Toast.makeText(MainActivity.this, finalMsg, Toast.LENGTH_LONG).show());
                return finalSuccess;
            } catch (Exception e) {
                e.printStackTrace();
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Error saving file: " + e.getMessage(), Toast.LENGTH_SHORT).show());
                return false;
            }
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Proactively request camera permission on app launch if not yet granted
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[] { Manifest.permission.CAMERA },
                    CAMERA_PERMISSION_REQUEST_CODE);
        }

        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.addJavascriptInterface(new WebAppInterface(), "AndroidNativeApp");

                CookieManager cookieManager = CookieManager.getInstance();
                cookieManager.setAcceptCookie(true);
                cookieManager.setAcceptThirdPartyCookies(webView, true);

                WebSettings settings = webView.getSettings();
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setCacheMode(WebSettings.LOAD_DEFAULT);
                settings.setRenderPriority(WebSettings.RenderPriority.HIGH);
                settings.setOffscreenPreRaster(true);
                settings.setAllowFileAccess(true);
                settings.setMediaPlaybackRequiresUserGesture(false);
            }
        } catch (Exception ignored) {
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        try {
            CookieManager.getInstance().flush();
        } catch (Exception ignored) {
        }
    }

    @Override
    public void onStop() {
        super.onStop();
        try {
            CookieManager.getInstance().flush();
        } catch (Exception ignored) {
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        try {
            CookieManager.getInstance().flush();
        } catch (Exception ignored) {
        }
    }
}
