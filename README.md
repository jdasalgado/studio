# System Requirements and Implementation Specifications

## 1. Resources
* **Development Hardware:** Laptop / Desktop PC for coding, running local development servers, and compiling Android builds.
* **Mobile Test Device:** Android smartphone (running Android 10 or higher) used for testing camera QR code scanning and mobile UI.
* **Internet Connection:** Stable broadband or Wi-Fi connection for syncing with the cloud database and fetching dependencies.
* **Database Hosting:** Supabase (PostgreSQL cloud database).

---

## 2. Software Requirements

* **Operating System:** Windows 10 / Windows 11 (64-bit)
* **Code Editor / IDE:** Visual Studio Code, Android Studio (for Android build and emulation)
* **Runtime Environment:** Node.js (v20 or higher)
* **Package Manager:** npm (v10 or higher)
* **Programming Languages:** TypeScript, JavaScript, SQL
* **Frontend Framework:** Next.js 16 (React 18 / 19)
* **Mobile Framework:** Capacitor 8 (Android platform)
* **Database:** PostgreSQL (hosted on Supabase)
* **Database ORM:** Prisma ORM (v5.22)
* **UI & Styling:** Tailwind CSS, Radix UI components, Lucide React icons
* **State Management & Data Fetching:** TanStack React Query (v5), Zustand
* **Web Browser:** Google Chrome / Microsoft Edge (for web testing and DevTools debugging)

---

## 3. Hardware Requirements

### Development Machine (PC / Laptop)

**Minimum:**
* **Processor:** Intel Core i5 (8th Gen) or AMD Ryzen 5
* **Memory:** 8 GB RAM
* **Storage:** 256 GB SSD (with at least 15 GB free disk space)
* **Display:** 1366 x 768 resolution

**Recommended:**
* **Processor:** Intel Core i5 / i7 (10th Gen or higher) or AMD Ryzen 5 / 7
* **Memory:** 16 GB RAM (handles simultaneous Next.js dev server, VS Code, and Android Studio builds)
* **Storage:** 512 GB SSD
* **Display:** 1920 x 1080 (Full HD)

---

### End-User / Mobile Devices

**Minimum:**
* **Device:** Android Smartphone
* **Operating System:** Android 10.0
* **RAM:** 2 GB RAM
* **Camera:** 5 MP rear camera with auto-focus (for QR scanning)

**Recommended:**
* **Device:** Android Smartphone
* **Operating System:** Android 11.0 or higher
* **RAM:** 4 GB RAM or higher
* **Camera:** 8 MP or higher with auto-focus
