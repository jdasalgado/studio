# 🎓 COG APP — SYSTEM DEVELOPMENT & DEFENSE REVIEWER
> **Target Audience:** Capstone / Thesis Defense Panel Presentation  
> **System Name:** COG App (Church Management & Operations System)  
> **Coverage:** Architecture, Tech Stack, Frameworks, Database, Major Modules, Security, & Panel Q&A

---

## 📌 TABLE OF CONTENTS
1. [Executive Summary & System Background](#1-executive-summary--system-background)
2. [Full Tech Stack & Framework Architecture](#2-full-tech-stack--framework-architecture)
   - *Bakit ito ang mga ginamit? (Panelist Justification)*
3. [Monorepo & System Architecture](#3-monorepo--system-architecture)
4. [Database Design & Schema Overview](#4-database-design--schema-overview)
5. [Deep Dive: Major Modules & Approaches](#5-deep-dive-major-modules--approaches)
   - Module 1: Authentication & Multi-Role RBAC
   - Module 2: Worker Profile & Ministry Management
   - Module 3: Tiered Approval Workflow Engine
   - Module 4: Room & Venue Reservation (Conflict Detection)
   - Module 5: Automated Attendance System (Smart Kiosk Scanner)
   - Module 6: Smart Meal Stub Allocation & Validation
   - Module 7: C2S (Connect 2 Souls) Discipleship Module
   - Module 8: Audit Logging & Security Subsystem
6. [Mobile App Integration (Capacitor & Android APK)](#6-mobile-app-integration-capacitor--android-apk)
7. [Predicted Panelist Questions & Model Answers (Mock Q&A)](#7-predicted-panelist-questions--model-answers-mock-qa)
8. [Quick Defense Tips & Strategy](#8-quick-defense-tips--strategy)

---

## 1. EXECUTIVE SUMMARY & SYSTEM BACKGROUND

### 💡 Ano ang COG App?
Ang **COG App** ay isang comprehensive Church Operations and Management System na binuo para sa **Church of God (COG) Dasmariñas**. Isa itong full-stack, cross-platform solution (Web + Mobile APK) na nagmo-modernize at nag-iisa ng mga dating hiwa-hiwalay at manual na sistema:
- **Legacy ORS (Online Reservation System):** Dating system para sa room reservations na kulang sa real-time conflict checking at mobile capability.
- **Legacy C2S (Connect 2 Souls):** Dating manual/spreadsheet monitoring ng cell groups at discipleship devotions.
- **Manual Attendance & Meal Distribution:** Mano-manong logbook at papel na meal stubs na prone sa dayaan, double-claiming, at human error.

### 🎯 Primary Objectives
1. **Automate & Digitize:** I-convert ang manual room reservation, meal stubs distribution, at attendance sa secure QR-based workflows.
2. **Eliminate Conflicts & Fraud:** Magpatupad ng mathematical interval overlap detection sa reservations at single-use validation sa meal stubs.
3. **Role-Based Governance (RBAC):** Magbigay ng hierarchical access control mula Super Admin, Department/Ministry Heads, hanggang Regular Workers.
4. **Cross-Platform Accessibility:** Desktop-ready web interface para sa administration at native Android APK para sa kiosk scanning at mobile workers.

---

## 2. FULL TECH STACK & FRAMEWORK ARCHITECTURE

| Layer | Technology / Tool | Version | Role / Justification |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | **Next.js (App Router)** | `v16.2+` (React 18) | Pinagsamang Client at Server-side rendering (SSR). Mabilis na loading, SEO-friendly, at may built-in API/Server Actions. |
| **Language** | **TypeScript** | `v5.x` | Strict type-safety, bawas runtime bugs, autocomplete para sa massive schema models. |
| **Styling & UI Components** | **Tailwind CSS + Radix UI + Lucide** | Tailwind v3 / Radix UI | Accessible headless UI components (accessible dialogs, popovers, sheets) na may customized Indigo-Violet church branding. |
| **Client State Management** | **Zustand + TanStack Query v5** | Zustand v5 / React Query v5 | **Zustand:** Lightweight global store para sa active session, permissions, at modal states nang walang Redux boilerplate.<br>**React Query:** Cache synchronization, background refetching, at zero latency updates. |
| **Mobile Runtime** | **Capacitor** | `v8.1` | Kino-compile ang Next.js web application bilang native Android APK (`cog-app-debug.apk`) na may direct camera hardware access. |
| **Database Engine** | **PostgreSQL** | Hosted on **Supabase** | Relational integrity, ACID compliance, foreign key cascades, at high-concurrency handling. |
| **Database ORM** | **Prisma ORM** | `v5.22` | Type-safe schema migrations, auto-generated Prisma Client, relational query joins, at transactional batching. |
| **Authentication** | **Supabase Auth** | Client SDK | Secure password hashing, session tokens, JWT, at automatic session persistence. |
| **Email Notifications** | **Resend SDK** | `@react-email/render` | Automated email dispatch para sa reservation approval, rejection notices, at admin password resets. |
| **QR Code Processing** | **Web BarcodeDetector API + jsQR** | Hardware-accel + Canvas | Dual-engine scanner: hardware-accelerated 60fps scanning sa supported devices na may automatic fallback sa pure JS decoding. |
| **Monorepo Build System** | **Turborepo** | `v2.x` | Multi-package workspace orchestration (`apps/web`, `packages/database`, `packages/ui`, etc.) para sa modular code reusability. |

### 🗣️ *Bakit hindi traditional MERN (MongoDB, Express, React, Node)?*
- **Sagot sa Panel:** *"Ang operasyon ng simbahan ay likas na relational—ang Workers ay kabilang sa Ministries, ang Ministries ay nasa ilalim ng Departments, ang Bookings ay nakatali sa specific Rooms at Workers, at may tiered approval chains. Ang **PostgreSQL + Prisma** ay nagbibigay ng matibay na Foreign Key integrity, ACID transactions (mahalaga laban sa double-booking), at relational queries na mas madaling i-maintain at mas reliable kaysa sa NoSQL document databases tulad ng MongoDB."*

---

## 3. MONOREPO & SYSTEM ARCHITECTURE

```
studio/ (Monorepo root)
├── apps/
│   ├── web/                     # Main Web & Capacitor Android App (Next.js 16)
│   │   ├── android/             # Native Android Studio project generated by Capacitor
│   │   ├── src/
│   │   │   ├── actions/db.ts    # ALL Server Actions (Backend Prisma Logic)
│   │   │   ├── app/             # App Router pages (/reservations, /attendance, /c2s, etc.)
│   │   │   ├── components/      # UI components (sidebar, modal, tables)
│   │   │   ├── hooks/           # Custom React hooks (useWorkers, useAttendance, etc.)
│   │   │   └── lib/             # Scanner config, utilities, validations
│   └── tract-tracker/           # Companion Expo React Native mobile app (Gospel Tracts)
├── packages/
│   ├── database/                # Prisma client & shared DB helpers
│   ├── store/                   # Zustand shared stores (auth, permissions)
│   ├── ui/                      # Shared Shadcn/Radix components
│   └── types/                   # Centralized TypeScript definitions
└── prisma/
    └── schema.prisma            # Single source of truth for database schema
```

---

## 4. DATABASE DESIGN & SCHEMA OVERVIEW

### Core Models & Relational Connections
1. **`Worker`:** Profile ng pastor, staff, o volunteer worker (`firstName`, `lastName`, `email`, `qrToken`, `status`, `employmentType`).
2. **`Department` & `Ministry`:** 
   - `Department` (e.g., Worship, Media, Pastoral Care) nagmamay-ari ng maraming `Ministry`.
   - `Ministry` nagtataglay ng `leaderId`, `headId`, `approverId`, `mealStubAssignerId`, at weekly allocation limits.
3. **`Role`, `Permission`, `WorkerRole`, `RolePermission`:** Many-to-Many RBAC schema gamit ang join tables para sa unlimited modular permission assignment.
4. **`Booking` & `Room`:** 
   - `Room` (capacity, room elements, status: 'Active' / 'Maintenance').
   - `Booking` (start, end, status: 'Pending Ministry Head Approval', 'Pending Admin Approval', 'Approved', 'Rejected').
5. **`ApprovalRequest`:** Polymorphic request entity para sa Room Bookings, New Worker Onboarding, at Ministry Transfers.
6. **`AttendanceRecord`:** Timestamped event (`Clock In`, `Clock Out`) na naka-link sa `Worker`.
7. **`MealStub`:** Stub record na may status (`Issued`, `Claimed`), stub type, date, at claiming timestamp.
8. **`C2SGroup`, `C2SMentee`, `C2SDevotionRecord`:** Discipleship network records.
9. **`TransactionLog` & `ScanLog`:** Immutable audit trails ng bawat security at scanner event.

---

## 5. DEEP DIVE: MAJOR MODULES & APPROACHES

---

### 🛡️ MODULE 1: AUTHENTICATION & MULTI-ROLE RBAC

#### 1. Paano Ginawa (Technical Approach)
- **Hybrid Auth & Profile Linking:**
  1. Gumagamit ng **Supabase Auth** para sa secure credentials verification (email/password).
  2. Sa sandaling mag-sign in, ang `authUserId` o `email` ay ginagamit upang i-query ang katugmang `Worker` record sa Prisma PostgreSQL database.
  3. Ang `user-role-syncer-sql.tsx` component ay agad na nagko-compute ng lahat ng active roles at permissions ng worker at ini-inject ito sa **Zustand store** (`useUserRole`, `usePermissions`).
- **Granular Permissions (`module:action`):**
  - Sa halip na hardcoded `"Admin"` o `"User"`, gumamit ng format tulad ng: `workers:view`, `workers:edit`, `reservations:create`, `reservations:approve`, `meals:claim`.
  - Isang worker ay maaaring magkaroon ng multiple roles (hal. isa siyang *Ministry Head* sa Worship, pero *Regular Worker* sa Media).

#### 2. Edge Cases & Solutions
- **Impersonation Mode:** May feature ang Super Admins na pansamantalang tignan ang app sa pananaw ng ibang worker para ma-debug ang dashboard nang hindi hinihingi ang password nila.
- **Force Password Reset:** May flag na `passwordChangeRequired: true` sa database kapag bagong gawa ang account ng admin para pilitin ang user na magpalit ng sariling password sa unang login.

---

### 👥 MODULE 2: WORKER PROFILE & MINISTRY MANAGEMENT

#### 1. Paano Ginawa (Technical Approach)
- **Life Cycle Workflow:**
  - `Pending Approval` $\rightarrow$ Kapag nag-signup ang bagong worker, pumapasok ito sa approval pool ng Ministry Head.
  - `Active` $\rightarrow$ Na-a-access ang dashboard, attendance, at meal stubs.
  - `Inactive` $\rightarrow$ Soft-deactivated worker (hindi mabubura ang historical records).
- **Unique QR Token Generation:**
  - Bawat worker record ay may auto-generated cryptographic UUID `qrToken`.
  - Ini-encode ito bilang high-resolution SVG/Canvas QR Code sa `/workers/my-qr` page na magsisilbing Digital ID ng worker.

#### 2. Org Structure Hierarchy
$$\text{Department} \longrightarrow \text{Ministries} \longrightarrow \text{Workers (Primary \& Secondary)}$$
- Pinapayagan ang workers na maging member ng Primary Ministry at Secondary Ministry.
- Kapag nagpalit ng ministry, gumagawa ang system ng `Ministry Change` approval request para maaprubahan ng outgoing at incoming ministry heads bago magbago ang database.

---

### 📅 MODULE 3: ROOM & VENUE RESERVATION (CONFLICT DETECTION)

#### 1. Paano Ginawa (Technical Approach)
- **The Core Conflict Algorithm (Interval Overlap Detection):**
  Bago i-save ang reservation, nagpapatakbo ang backend ng indexed database query:
  ```typescript
  const conflicting = await prisma.booking.findFirst({
    where: {
      roomId,
      status: { notIn: ['Rejected', 'Cancelled'] },
      start: { lt: new Date(requestedEnd) },
      end: { gt: new Date(requestedStart) },
    }
  });
  ```
  > **Mathematical Logic:** May overlap kung at tanging kung:  
  > $$\text{Existing Start} < \text{New End} \quad \text{AND} \quad \text{Existing End} > \text{New Start}$$
- **Atomic Transaction (`prisma.$transaction`):**
  - Upang maiwasan ang **Race Condition** (dalawang user na sabay nag-click ng reserve sa parehong millisecond), ang conflict check, booking creation, at approval creation ay nakabalot sa isang atomic database transaction. Kung may conflict, magro-rollback agad at magbabalik ng error.
- **Maintenance Lock:**
  - Kapag ang Room ay naka-set sa status na `Maintenance`, auto-blocked ang reservations at naglalabas ng descriptive error.

#### 2. Equipment & Logistics Integration
- Bukod sa kwarto, nakakapag-request ang user ng assistance at equipment: bilang ng lamesa, upuan, TV, Mikropono, Speakers, at Sound Tech Assistance.

---

### ⚖️ MODULE 4: TIERED APPROVAL WORKFLOW ENGINE

#### 1. Paano Ginawa (Technical Approach)
- **2-Tier Hierarchical Approval Flow:**
  ```
  [Regular Worker files Room Reservation]
                 │
                 ▼
      [Pending Ministry Head Approval]
                 │ (Approved by Ministry Head)
                 ▼
        [Pending Admin Approval]
                 │ (Approved by Admin)
                 ▼
            [APPROVED]
  ```
- **Smart Role-Bypass:**
  - Kung ang mismong nag-reserve ay isang **Ministry Head** o **Super Admin**, awtomatikong lumalampas (bypassed) ang Tier 1 at dumederetso agad sa `Pending Admin Approval` o auto-approved upang maiwasan ang redundancy.
- **Cross-Ministry Security Isolation:**
  - Sa `updateApproval` action, chine-check ang `actorId` laban sa ministry ng request. Hindi maaaring aprubahan ng Head ng "Ushering" ang request na para sa "Music Ministry".
- **Real-Time Notification Side-Effects:**
  - Paggamit ng **Resend SDK**: Sa sandaling ma-approve o ma-reject ang request, nagpapadala ng automated email notice kasama ang Rejection Reason o Confirmation Slip.

---

### ⏱️ MODULE 5: AUTOMATED ATTENDANCE SYSTEM (SMART KIOSK SCANNER)

#### 1. Paano Ginawa (Technical Approach)
- **Dual-Engine Scanning Architecture:**
  - **Engine 1 (Primary):** Native Web `BarcodeDetector` API. Ginagamit ang hardware GPU/NPU ng device para sa zero-lag 60fps QR detection.
  - **Engine 2 (Fallback):** `jsQR` canvas processor. Awtomatikong sumasalo kapag ang browser ay walang native BarcodeDetector.
- **Smart State Machine Logic (`recordAutoAttendance`):**
  Hindi na kailangang pumili ng worker kung "Clock In" o "Clock Out"—ang system na ang matalinong nagdedesisyon:
  1. **Walang record ngayong araw:** $\rightarrow$ Automatic **`Clock In`**.
     - Kinakalkula kung **`On Time`** o **`Late`** base sa dynamic `shiftStartTime` (hal. 09:00 AM) + `gracePeriodMinutes` (hal. 15 mins).
  2. **May existing `Clock In` record:**
     - **Cooldown Check (5 mins):** Kapag na-scan ulit agad sa loob ng 5 minuto, nagba-block ang system ng `"Cooldown Error"` upang maiwasan ang accidental double-tap.
     - **Lapas sa Cooldown:** $\rightarrow$ Automatic **`Clock Out`**.
     - Kinakalkula kung **`Shift Completed`** o **`Undertime`** base sa dynamic `shiftEndTime` (hal. 05:00 PM).
- **Kiosk Mode Lock Protection:**
  - Dahil ang scanner tablet/phone ay nakatambay sa entrance ng church, may built-in **Session Lock Modal**.
  - Kailangan ng configured Admin Password (`CogMain123` o customized) para i-lock o i-unlock ang scanner para hindi mapakialaman ng dumadaang tao ang browser tabs o settings.

---

### 🍱 MODULE 6: SMART MEAL STUB ALLOCATION & VALIDATION

#### 1. Paano Ginawa (Technical Approach)
- **Weekly & Day-Specific Allocations:**
  - Ang bawat Department at Ministry ay may nakalaang maximum quota ng meal stubs (Weekday Allocation vs Sunday Allocation).
  - Pinipigilan ng system ang pag-issue kapag naabot na ang quota ceiling.
- **Anti-Fraud Single-Use Validation:**
  - Kapag ini-scan ng kusina/canteen staff ang QR ng worker:
    ```
    Is MealStub status == 'Issued'?
       ├── YES: Update status to 'Claimed', set claimedAt = now(). Display Success Green Banner!
       └── NO: (Already Claimed): Trigger Destructive Warning Dialog: "Stub Already Claimed on [Time]".
    ```
  - Imposibleng i-screenshot ng worker ang QR at ipamigay sa kakilala para mag-claim ng higit sa isang beses.

---

### 📖 MODULE 7: CONNECT 2 SOULS (C2S) DISCIPLESHIP MODULE

#### 1. Paano Ginawa (Technical Approach)
- **Discipleship Cell Management:**
  - Namamahala ng mga grupo kung saan may `Mentor` at listahan ng `Mentees`.
- **Devotional Manual Submission:**
  - Lingguhang report form na nagtatala ng: Manual Type, Module Title, Lesson Title, Topic, Scripture, Attendee Names & Count, Reflection Notes, Prayer Requests, at picture attachment.
- **Analytics & Ministry Health Tracking:**
  - Nakikita ng Church Pastors kung aling cell groups ang aktibong nagmi-meeting at lumalago, at sinong mga miyembro ang kailangan ng follow-up prayer.

---

### 🔍 MODULE 8: AUDIT LOGGING & SECURITY SUBSYSTEM

#### 1. Paano Ginawa (Technical Approach)
- **Audit Trails (`TransactionLog` & `ScanLog`):**
  - Bawat kritikal na mutation (Role change, Worker deletion, Booking cancellation, Meal claim) ay sumusulat sa `TransactionLog` kasama ang `userId`, `action`, `module`, `details`, at `timestamp`.
  - Hindi nabubura ang logs kahit ma-delete ang target worker.
- **Route Protection & Server-Side Verification:**
  - Lahat ng Server Actions sa `actions/db.ts` ay nagpapatunay ng `actorId` at role permissions sa mismong backend—hindi lang sa UI components—upang maiwasan ang unauthorized API invocation via DevTools o curl.

---

## 6. MOBILE APP INTEGRATION (CAPACITOR & ANDROID APK)

### 📱 Bakit Capacitor sa halip na Pure Web o Full Native Java/Kotlin?
1. **Single Unified Codebase:** Ang mismong Next.js 16 app ang tumatakbo sa loob ng Capacitor Webview container, kaya anumang update sa web ay instant ding nagre-reflect sa mobile nang hindi nagdo-double coding.
2. **Hardware Camera Access:** Nagbibigay ang Capacitor ng native bridge (`@capacitor/camera`, `@capacitor/core`) para ma-access ang rear camera na may autofocus para sa high-speed QR scanning.
3. **Android Studio Packaging:** Madaling na-compile sa release-ready APK (`cog-app-debug.apk`) na mai-install sa anumang Android 10+ smartphone o kiosk tablet.

---

## 7. PREDICTED PANELIST QUESTIONS & MODEL ANSWERS (MOCK Q&A)

### Q1: *"Bakit Next.js Server Actions ang ginamit niyo sa halip na mag-create ng hiwalay na Express.js backend API?"*
> **Model Answer:**  
> *"Ginamit po namin ang Next.js Server Actions dahil nagbibigay ito ng **Full-Stack Type Safety** at **Zero-API Overhead**. Dahil nasa iisang monorepo ang client at server, direktang na-e-export ang mga functions tulad ng `submitRoomReservation()` mula sa backend papunta sa UI forms na may buong TypeScript autocomplete at validation. Nababawasan nito ang network latency, inaalis ang boilerplates ng standard REST routing (tulad ng controllers at route handlers), at secure itong tumatakbo exclusively sa server nang hindi na-e-expose ang database credentials sa browser."*

---

### Q2: *"Paano ninyo sinisigurado na walang mangyayaring Double-Booking sa mga kwarto kapag sabay na nag-click ang dalawang users?"*
> **Model Answer:**  
> *"May dalawang layer po kami ng proteksyon:  
> 1. **Mathematical Interval Check:** Chine-check ng system kung `Existing Start < New End AND Existing End > New Start` para sa status na hindi Rejected o Cancelled.  
> 2. **Database Atomic Transaction:** Ang check at insertion ay nakapaloob sa `prisma.$transaction()`. Sa PostgreSQL, kapag may transaction lock, ang pangalawang magtatangkang mag-commit ay makakatanggap ng conflict rollback error bago pa maipasok sa database ang duplicate entry."*

---

### Q3: *"Bakit dual engine ang QR Scanner ninyo (BarcodeDetector + jsQR)?"*
> **Model Answer:**  
> *"Iba-iba po ang hardware at browser ng mga Android devices ng simbahan. Ang modernong Chrome browsers sa Android ay may native hardware-accelerated **BarcodeDetector API** na mabilis at mababa sa battery consumption. Subalit, para sa mga lumang devices o browser environments na walang ganitong Web API, mayroon kaming automatic fallback sa **jsQR** na nagde-decode ng raw canvas frames via pure JavaScript. Dahil dito, 100% device compatibility ang aming naabot."*

---

### Q4: *"Paano niyo pinoprotektahan ang data privacy ng mga Workers at Church Members?"*
> **Model Answer:**  
> *"Naka-base po kami sa **Least Privilege Principle**. Sa pamamagitan ng aming Multi-Role RBAC, ang isang regular worker ay makikita lamang ang kanyang personal QR at sariling profile. Ang Ministry Heads ay limitado lamang sa data ng mga workers sa ilalim ng kanilang departamento. Bukod dito, ang sensitive operations tulad ng password resets ay dumadaan sa Supabase Auth encryption at naka-record sa Transaction Logs ang bawat pagbabago."*

---

### Q5: *"Ano ang pinagkaiba ng Next.js Web App sa Tract Tracker app sa monorepo?"*
> **Model Answer:**  
> *"Ang **COG Web App (apps/web)** ay ang centralized operations management system (Workers, Reservations, Attendance, Meals, C2S). Samantala, ang **Tract Tracker (apps/tract-tracker)** ay isang standalone lightweight mobile utility gamit ang Expo React Native na idinesenyo para sa taunang Gospel Tracts Giving Day kung saan nag-i-increment ng live count ng naipamigay na tracts sa bawat barangay gamit ang OpenStreetMap/Leaflet integration. Naka-host sila sa iisang monorepo upang magamit ang parehong database at TypeScript types nang walang redundancy."*

---

## 8. QUICK DEFENSE TIPS & STRATEGY

1. **Mag-focus sa Problem-Solving:** Huwag lang sabihing *"Gumamit kami ng Next.js at Prisma"*. Sabihin kung **anong problema ng COG Dasmariñas ang nalutas** ng technology na iyon (e.g. *"Nawala ang 100% ng double-booking dahil sa automated interval check"*).
2. **Live Demo Confidence:**
   - Ipakita ang **Attendance Scanner**: Mag-scan ng worker QR $\rightarrow$ ipakitang nag-Clock In $\rightarrow$ i-scan ulit agad $\rightarrow$ ipakitang na-trigger ang Cooldown protection.
   - Ipakita ang **Conflict Detection**: Mag-reserve ng Room sa 2:00 PM - 4:00 PM $\rightarrow$ magtangkang mag-reserve ulit sa 3:00 PM - 5:00 PM $\rightarrow$ ipakita ang instant error alert.
3. **Maging Transparent sa Limitations:** Kung tanungin ang future scope:
   - *SMS Gateway integration bukod sa Email.*
   - *Offline-first background syncing gamit ang PWA Service Workers.*
   - *AI-assisted room layout and schedule optimization.*

---
*Good luck sa defense niyo bukas! Kumpiyansa lang sa bawat pagsagot—kayo ang gumawa ng system, kaya kayo ang pinaka-eksperto sa bawat linya ng code na ito.* 🚀

