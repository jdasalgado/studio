# 📊 Pinakabagong Entity-Relationship Diagram (ERD)
### Inventory Management, Equipment Checkout/Return, Damaged/Lost Tracking & Incident PDF Report

---

## 1. Visual ERD Diagram

```mermaid
erDiagram
    Worker ||--o{ InventoryBorrowing : "borrows"
    Worker ||--o{ InventoryLog : "initiates_action"
    Worker ||--o{ TransactionLog : "operates"
    
    InventoryCategory ||--o{ InventoryItem : "categorizes"
    
    InventoryItem ||--o{ InventoryItem : "bundle_kit_children (parentId)"
    InventoryItem ||--o{ InventoryBorrowing : "is_borrowed"
    InventoryItem ||--o{ InventoryLog : "logs_history"
    
    InventoryBorrowing ||..o{ IncidentReportPDF : "auto_generates"

    Worker {
        String id PK "UUID"
        String workerId "Worker / Staff Code"
        String firstName "First Name"
        String lastName "Last Name"
        String email UK "Worker Email"
        String status "Active / Inactive"
    }

    InventoryCategory {
        String id PK "UUID"
        String name UK "Category Name"
        String color "Badge / UI Hex Color"
        String icon "Lucide Icon Name"
        String group "Equipment / Consumable"
        Boolean isActive "Active status"
    }

    InventoryItem {
        String id PK "UUID"
        String inventoryCode UK "Item Barcode / QR Code"
        String name "Item Description / Name"
        String categoryId FK "Reference to InventoryCategory"
        String type "EQUIPMENT or CONSUMABLE"
        Int quantity "Current Available Stock"
        Int minQuantity "Low-stock alert threshold"
        String unit "pcs, sets, boxes, etc."
        String status "Good Condition, Damaged, Borrowed"
        String statusDetails "Detailed status notes"
        String group "Single or Kit / Bundle"
        String parentId FK "Self-referencing Bundle Parent"
        String location "Storage Room / Venue"
        String aisle "Aisle Location"
        String shelf "Shelf Location"
        String bin "Bin / Rack Location"
        String imageUrl "Item display photo"
        DateTime nextMaintenanceDate "Scheduled maintenance"
        DateTime createdAt "Creation timestamp"
        DateTime updatedAt "Last update timestamp"
    }

    InventoryBorrowing {
        String id PK "UUID"
        String itemId FK "Reference to InventoryItem"
        String borrowerId FK "Reference to Worker"
        DateTime borrowedAt "Checkout timestamp"
        DateTime dueDate "Borrow due / Target resolution deadline"
        DateTime returnedAt "Actual check-in timestamp"
        String status "BORROWED, RETURNED, PENDING"
        String checkoutCondition "Condition at checkout"
        String checkoutNotes "Purpose / Remarks upon checkout"
        Json checkoutChecklist "Includes issued accessories: Lens, Battery, SD Card, etc."
        String returnCondition "Good, Damaged, Lost, Missing Gear, Resolved"
        String returnNotes "Inspection / damage / loss incident notes"
        Json returnChecklist "Returned vs missing accessories & target resolution deadline"
        String_Array returnPhotos "Base64 or Cloud URLs of damage evidence"
    }

    InventoryLog {
        String id PK "UUID"
        String itemId FK "Reference to InventoryItem"
        String workerId FK "Staff / Actor Worker ID"
        String type "Checkout, Return, Adjustment, Restored"
        Int quantity "Quantity changed"
        Int balance "Remaining stock balance after action"
        String notes "Audit trail details"
        DateTime timestamp "Action timestamp"
    }

    TransactionLog {
        String id PK "UUID"
        String userId "Operator User ID"
        String userEmail "Operator Email"
        String userName "Operator Name"
        String module "Inventory"
        String action "Checkout, Return, Report Generated, Restored"
        String details "Human-readable activity summary"
        String targetId "Target Item or Borrowing ID"
        String targetName "Target Item Name"
        DateTime timestamp "Audit timestamp"
    }

    IncidentReportPDF {
        String reportId "RPT-XXXX (Auto-generated)"
        DateTime reportDate "Date & time of generation"
        String reportedBy "Staff / Admin processor"
        String incidentType "DAMAGED, LOST, or MISSING"
        String itemDetails "Name, Code, Category, Borrowing ID"
        String borrowerDetails "Name, ID, Email, Borrow & Return Dates"
        String incidentContext "Condition details & inspection notes"
        Json accessoriesStatus "Table of included items with ✓ RETURNED or ✗ LOST"
        String damagePhotoUrl "Embedded damage/loss evidence image"
        String resolutionInfo "Target repair/settlement deadline & notes"
        String signatures "Borrower, Staff, Authorized Officer sign-offs"
    }
```

---

## 2. Talaan ng mga Bagong Attribute at Halaga

### A. `InventoryBorrowing` (Check-in, Damage & Loss Tracking)
| Column / Field | Data Type | Layunin / Gamit sa Bagong Feature |
| :--- | :--- | :--- |
| `status` | `String` | Pinalawak upang suportahan ang **`PENDING`** para sa mga item na naibalik na sira (Damaged), nawawala (Lost), o kulang ang accessories. Nanatiling `BORROWED` habang gamit, at nagiging `RETURNED` kapag Good Condition o Resolved na. |
| `checkoutChecklist` | `Json` | Naglalaman ng `includedEquipment: string[]` (hal. Lens, Battery, SD Card, Tripod, Bag). |
| `returnCondition` | `String` | Nagtatala kung `Good Condition`, `Minor Wear`, `Damaged`, `Lost`, o `Resolved`. |
| `returnChecklist` | `Json` | Nagtatala ng status ng bawat accessory (`returnedInclusions: { [gear]: boolean }`), mga nawawala (`missingItems: string[]`), at ang napagkasunduang deadline (`resolutionDeadline`). |
| `returnPhotos` | `String[]` | Array ng mga base64 o cloud URL ng kuha ng camera o inupload na ebidensya ng sira. |
| `dueDate` | `DateTime` | Bukod sa orihinal na return due date, ginagamit din bilang **Target Resolution / Replacement Deadline** kapag pending resolution. |

### B. `InventoryItem` (Stock Protection para sa Damaged / Lost)
| Column / Field | Data Type | Layunin / Gamit sa Bagong Feature |
| :--- | :--- | :--- |
| `status` | `String` | Automatic na minamarkahan bilang `Damaged` o `Lost`. Hindi ibinabalik sa available stock ang item kung ito ay reported na nawala o sira hangga't hindi pa nare-resolve. |
| `quantity` | `Int` | Ang bilang ng stock na pwedeng hiramin. Nababawasan sa Checkout, ibinabalik sa Return (kung good condition), at nire-restore lamang kapag minarkahang *Resolved / Repaired / Replaced*. |
| `parentId` / `children` | `Self-relation` | Para sa mga **Kit / Bundles** (hal. Camera Drone na may kasamang drone body, controller, extra props, at hard case). |

### C. `IncidentReportPDF` (Export Data Structure)
| Component | Functionality |
| :--- | :--- |
| **Header Strip** | Nagtataglay ng Church Name, Report ID (`RPT-XXXXXXXX`), Type Badge, at Creation Date sa Dark Navy Blue (`#1c4184`). |
| **Equipment & Borrower Details** | 2-Column summary ng gamit at ng taong humiram. |
| **Incident Details** | Reason, inspection notes, at pangalan ng admin/staff na tumanggap. |
| **Accessories Checklist** | Auto-table ng lahat ng inisyu na gamit na may kulay na tag (**✓ RETURNED** o **✗ LOST / MISSING**). |
| **Damage Photo** | Direktang naka-embed ang uploaded camera evidence sa loob ng PDF. |
| **Resolution & Signatures** | Deadline ng pag-aayos o pagpapalit at 3 signature blocks (Borrower, Inventory Staff, Authorized Approver). |

