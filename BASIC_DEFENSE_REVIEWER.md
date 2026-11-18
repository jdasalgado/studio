# ⚡ QUICK & BASIC DEFENSE REVIEWER (Cheat Sheet)
> **Basahin ito 10-15 minutes bago ang defense.** Walang paliguy-ligoy, diretso sa punto!

---

## 🎯 1. ANO ANG SYSTEM NIYO SA ISANG PANGUNGUSAP?
> *"Ang **COG App** ay isang web at mobile church management system para sa **COG Dasmariñas** na nag-o-automate ng Room Reservations, QR Attendance, Meal Stubs, at C2S Discipleship tracking para mawala ang manual logbook at double-booking."*

---

## 🛠️ 2. MGA GINAMIT NA TOOLS & FRAMEWORKS (Kabisaduhin mo lang 'to!)

| Anong Gamit? | Tool / Framework | Bakit ito ang ginamit? (Sabihin mo sa panel) |
| :--- | :--- | :--- |
| **Frontend** | **Next.js 16 + React** | Mabilis mag-load at modern. Pinagsama na ang front-end at back-end sa iisang project. |
| **Design / UI** | **Tailwind CSS + Radix UI** | Malinis, responsive (mobile at desktop), at madaling i-customize ang itsura. |
| **Database** | **PostgreSQL (Supabase)** | Relational database. Mahigpit sa integrity para bawal ang duplicate o sirang data. |
| **Database ORM** | **Prisma** | Tagapamagitan ng code at database. Mas madali at ligtas mag-query kaysa pure raw SQL. |
| **Mobile App** | **Capacitor** | Ginawang Android App (`.apk`) ang website para magamit ang camera sa mabilisang QR scan. |
| **State / Cache** | **Zustand + React Query** | Para instant mag-update ang data sa screen nang hindi kailangang i-refresh ang page. |
| **Email** | **Resend** | Awtomatikong nag-e-email sa user kapag Approved o Rejected ang reservation nila. |

---

## ⚙️ 3. PAANO GUMAGANA ANG MGA MAJOR MODULES? (Simple Logic)

### 1️⃣ Room Reservation (Paano iniiwasan ang Double-Booking?)
* **Logic:** Bago i-save ang reservation, tinitingnan ng system kung may kaparehong kwarto sa parehong oras gamit ang formula:
  $$\text{Existing Start} < \text{Bagong End} \quad \text{AND} \quad \text{Existing End} > \text{Bagong Start}$$
* **Result:** Kapag may tumapat kahit 1 minuto, **auto-block** at may lalabas na error: *"Room already reserved."*
* **Maintenance:** Kapag sira ang kwarto, pwedeng i-set ng Admin sa `Maintenance` para bawal muna i-reserve.

---

### 2️⃣ QR Attendance Kiosk (Paano gumagana ang Scanner?)
* **Auto-Detect (Hindi na pipindot kung In o Out):**
  1. **Unang scan sa araw na 'to:** $\rightarrow$ Awtomatikong **Clock In** (Sasabihin kung *On-Time* o *Late* base sa shift hours).
  2. **Kapag inulit agad (< 5 mins):** $\rightarrow$ May lalabas na **Cooldown Alert** para hindi mag-doble ang record kapag aksidenteng naitapat ulit ang QR.
  3. **Pangalawang scan (> 5 mins):** $\rightarrow$ Awtomatikong **Clock Out** (*Shift Completed* o *Undertime*).
* **Kiosk Lock:** May lock password (`CogMain123`) para hindi mapakialaman o maisara ng iba ang camera scanner.

---

### 3️⃣ Meal Stubs (Paano maiiwasan ang dayaan?)
1. May allocation limit ang bawat ministry (hal. hanggang 10 stubs lang sa weekday).
2. Kapag na-scan ang QR ng worker:
   * **Kung bago pa lang:** Magiging **`Claimed`** ang status at lalabas ang berdeng checkmark.
   * **Kung na-claim na o screenshot lang:** Lalabas agad ang pulang warning: *"Stub already claimed at [Oras]"*. Bawal gamitin nang dalawang beses!

---

### 4️⃣ Approval Workflow (Sino ang nag-a-apruba?)
* **2-Step Approval:**
  $$\text{Regular Worker} \longrightarrow \text{Ministry Head} \longrightarrow \text{Super Admin} \longrightarrow \text{APPROVED}$$
* **Smart Bypass:** Kung ang nag-request ay mismong Ministry Head o Admin, hindi na kailangan dumaan sa Head approval—diretso na sa Admin.

---

### 5️⃣ C2S (Connect 2 Souls Discipleship)
* Minomonitor ang mga cell groups: sinong mentor, sinong mentees, anong lesson/topic ang tinuro, ilan ang umattend, at may picture upload bilang patunay ng devotion meeting.

---

## 🗣️ 4. TOP 5 TANONG NG PANEL & TAMANG ISASAGOT

### Q1: *"Bakit Next.js at hindi hiwalay na React at Express.js?"*
> **Sagot:**  
> *"Dahil sa **Server Actions** po ng Next.js. Hindi na po namin kailangang gumawa ng hiwalay na API endpoints at backend server. Mas mabilis po ang development, less network lag, at mas secure dahil sa server lang tumatakbo ang database operations."*

---

### Q2: *"Bakit PostgreSQL / Supabase ang database niyo at hindi MongoDB?"*
> **Sagot:**  
> *"Dahil relational po ang structure ng simbahan—ang Workers ay kabilang sa Ministries, ang Ministries ay nasa ilalim ng Departments, at ang Bookings ay nakatali sa specific Rooms. Sa PostgreSQL po, may **Foreign Key integrity** at **Transactions** na pumipigil sa data duplication."*

---

### Q3: *"Paano niyo napagana sa Mobile Android ang web app?"*
> **Sagot:**  
> *"Ginamit po namin ang **Capacitor**. Binalot po nito ang aming Next.js web application bilang isang native Android APK. Dahil dito, nagagamit po namin ang mismong camera ng phone nang mabilis para sa QR barcode scanning."*

---

### Q4: *"Paano kung i-screenshot ng worker ang QR code at ibigay sa iba para mag-claim ng pagkain?"*
> **Sagot:**  
> *"Hindi po gagana ang dayaan dahil **Single-Use** po ang meal stub sa database. Sa sandaling ma-scan ito ng canteen staff, magpapalit agad ang status sa `Claimed`. Kapag sinubukang i-scan ulit ang screenshot, lalabas agad sa screen na 'Already Claimed' kasama ang exact timestamp kung kailan ito kinuha."*

---

### Q5: *"Ano ang pinakamalaking problemang na-solve ng inyong system?"*
> **Sagot:**  
> *"Naalis po namin ang **100% ng double-booking** sa mga venue at rooms gamit ang automated conflict checking, at napabilis ang pag-log ng attendance at pamamahagi ng meal stubs mula sa mabagal na papel papuntang instant 1-second QR scanning."*

---

## 🔒 5. SYSTEM & DATA SECURITY (Paano protektado ang System?)
Kung tanungin kayo: *"Paano ninyo sinisigurado ang security ng users, data, at ng buong system?"*

Ito ang **4 Layers of Security** (Defense-in-Depth approach):

1. **User Authentication & Passwords:**
   * Gumagamit ng **Supabase Auth**. Ang passwords ay hindi naka-plain text; naka-encrypt gamit ang industry-standard **salted hashing (bcrypt)**.
   * May **Force Password Reset** feature para sa mga bagong account na ginawa ng Admin para mapalitan agad ng user ang temporary password nila.
2. **Role-Based Access Control (RBAC) & Least Privilege:**
   * Hindi lang sa UI tinatago ang buttons; sa mismong **Server Actions (backend)** chine-check ang permissions gamit ang `module:action` rules.
   * May **Cross-Ministry Isolation**: Hindi pwedeng aprubahan o pakialaman ng Ministry Head ng Ushers ang reservations o data ng Music Ministry.
3. **Database Security & SQL Injection Protection:**
   * Dahil gumagamit ng **Prisma ORM**, 100% ng database queries ay **Parameterized Queries**. Imposible ang classic SQL Injection dahil hindi pinagdidikit (concatenate) ang raw text sa SQL statements.
   * Ang database credentials (`DATABASE_URL`, Service Role Keys) ay nakatago sa **Environment Variables (`.env`)** sa server at kailanman ay hindi nakikita sa browser/client bundle.
4. **Physical Kiosk & QR Anti-Fraud:**
   * **Single-Use Validation:** Bawat meal stub ay nagiging `Claimed` pagkatapos i-scan, kaya balewala ang screenshots o dayaan.
   * **Kiosk Session Lock:** May PIN protection ang attendance scanner (`CogMain123`) para hindi maisara o mapalitan ng publiko ang settings.
   * **Immutable Audit Trail (`TransactionLog`):** Bawat delete, update, at approval ay may permanenteng log kung SINO, KAILAN, at ANONG ginawa.

---

## 📱 6. LAHAT NG TANONG TUNGKOL SA QR CODE (Kabisaduhin Ito!)

### Q1: *"Ano ang nakapaloob sa QR Code? Hindi ba delikado kung ma-scan ng ordinaryong camera?"*
> **Sagot:**  
> *"Hindi po delikado, Sir/Ma'am. Ang laman po ng aming QR code ay hindi plain personal info o passwords, kundi isang **unique, opaque cryptographic UUID (`qrToken`)**. Kahit i-scan ito ng third-party phone camera, isa lamang itong random string ng characters na walang saysay kung wala ang aming system. Tanging ang aming backend lamang ang may kakayahang i-map ang token na iyon papunta sa verified worker record."*

### Q2: *"Bakit QR Code ang pinili niyo at hindi Biometrics (Fingerprint) o RFID Card?"*
> **Sagot:**  
> *"May tatlong dahilan po kami:*  
> 1. ***Cost-Effective (Makatipid ang Simbahan):** Hindi na kailangan ng simbahan bumili ng mamahaling hardware RFID cards, RFID readers, o fingerprint scanners para sa daan-daang workers. Mismong camera ng tablet/phone ang scanner.  
> 2. ***Contactless & Fast:** Mas mabilis at sanitary ang QR scan sa entrance kumpara sa maruming fingerprint reader na madalas nagfe-fail kapag basa o marumi ang daliri.  
> 3. ***Zero-Loss (Laging nasa Phone):** Madaling mawala o maiwan ang pisikal na RFID card, samantalang ang QR ID ay laging nasa smartphone ng worker."*

### Q3: *"Paano kung i-screenshot ang QR at ipasa sa iba para magpa-attendance (Buddy Punching / Proxy Attendance) o mag-claim ng pagkain?"*
> **Sagot:**  
> *"May dalawa po kaming security countermeasure:*  
> 1. ***Para sa Pagkain (Meal Stubs):** **Single-Use** po ang verification. Kapag na-scan na, automatic `Claimed` na sa database. Kahit i-send ang screenshot sa limang tao, ang unang mag-scan lang ang makakakuha, at ang mga susunod ay mag-e-error ng 'Already Claimed at [Time]'.  
> 2. ***Para sa Attendance:** Naka-station po ang aming kiosk scanner sa mismong entrance ng simbahan na may nagbabantay na usher. Bukod dito, kung may hinala na na-compromise o kumalat ang screenshot ng QR ng worker, may **Regenerate QR Token** button ang Admin para maglabas agad ng bagong QR at gawing invalid ang lumang screenshot."*

### Q4: *"Paano gumagana ang inyong Scanner at bakit napakabilis nito mag-detect?"*
> **Sagot:**  
> *"Gumagamit po kami ng **Dual-Engine Architecture**:  
> * **Primary Engine:** Native Web **BarcodeDetector API** na gumagamit ng hardware acceleration (GPU) ng device para sa 60fps instant detection.  
> * **Fallback Engine:** **jsQR** na nagde-decode via pure software canvas kapag lumang browser ang gamit.  
> Dahil dito, wala pong lag at compatible sa 100% ng devices."*

---

## 💡 7. MGA DAPAT TANDAAN SA LIVE DEMO BUKAS
1. **Sa Attendance Scanner:** I-scan ang QR $\rightarrow$ ipakita na nag-Clock In $\rightarrow$ itapat ulit agad para makita ng panel ang **Cooldown protection**.
2. **Sa Room Reservation:** Mag-reserve sa Room 1 ng 1:00 PM to 3:00 PM $\rightarrow$ mag-reserve ulit sa parehong Room 1 ng 2:00 PM to 4:00 PM $\rightarrow$ ipakita na na-detect at **na-block agad ng system ang conflict**.
3. **Maging kalmado:** Kayo ang gumawa ng system, kaya walang ibang mas nakakaalam ng inyong project kundi kayo!

Good luck bro, kayang-kaya niyo 'yan bukas! 🎓🔥

