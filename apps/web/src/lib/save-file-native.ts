/**
 * Native file-saving helper for Android APK (via AndroidNativeApp JavascriptInterface)
 * with graceful fallback to standard browser downloads.
 */

declare global {
  interface Window {
    AndroidNativeApp?: {
      openAppSettings?: () => void;
      requestCameraPermission?: () => void;
      saveBase64File?: (base64Data: string, fileName: string, mimeType: string) => boolean;
    };
  }
}

/**
 * Checks if the app is currently running inside our Android native WebView wrapper.
 */
export function isAndroidNativeApp(): boolean {
  return typeof window !== "undefined" && typeof window.AndroidNativeApp?.saveBase64File === "function";
}

/**
 * Converts a Blob to a pure Base64 string (including data URL prefix if requested).
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Universal file saver:
 * - If inside Android APK -> invokes AndroidNativeApp.saveBase64File() which saves to MediaStore (Pictures/Downloads)
 * - If in normal browser -> triggers standard browser download (<a download>)
 */
export async function saveFileUniversal(
  data: Blob | string,
  filename: string,
  mimeType: string
): Promise<boolean> {
  if (isAndroidNativeApp()) {
    try {
      let base64String: string;
      if (typeof data === "string") {
        base64String = data;
      } else {
        base64String = await blobToBase64(data);
      }
      const saved = window.AndroidNativeApp!.saveBase64File!(base64String, filename, mimeType);
      return !!saved;
    } catch (err) {
      console.warn("[saveFileUniversal] Native Android save error, falling back to web download:", err);
    }
  }

  // Standard web browser fallback
  try {
    let url: string;
    let cleanup = false;

    if (typeof data === "string") {
      if (data.startsWith("data:") || data.startsWith("blob:") || data.startsWith("http")) {
        url = data;
      } else {
        const blob = new Blob([data], { type: mimeType });
        url = URL.createObjectURL(blob);
        cleanup = true;
      }
    } else {
      url = URL.createObjectURL(data);
      cleanup = true;
    }

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (cleanup) {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    return true;
  } catch (err) {
    console.error("[saveFileUniversal] Web download failed:", err);
    return false;
  }
}

