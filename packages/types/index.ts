export type TimestampLike = {
    toDate?: () => Date;
    seconds?: number;
    nanoseconds?: number;
} | Date | string;

export type Role = {
    id: string;
    name: string;
    permissions?: string[];
}

export type Worker = {
    id: string;
    workerId?: string | null;
    workerNumber?: number | null;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    roleId?: string | null;
    status: 'Active' | 'Inactive' | 'Pending Approval' | string;
    avatarUrl: string;
    majorMinistryId: string;
    minorMinistryId: string;
    assignedMinistryIds?: string[];
    employmentType?: 'Full-Time' | 'On-Call' | 'Volunteer' | string | null;
    birthDate?: string | null;
    address?: string | null;
    startMonth?: string | null;
    startYear?: string | null;
    remarks?: string | null;
    biometricsId?: number | null;
    isSeniorPastor?: boolean | null;
    isPastor?: boolean | null;
    legacyPasswordHash?: string | null;
    passwordChangeRequired?: boolean | null;
    qrToken?: string | null;
    createdAt: TimestampLike | Date;
};

export type Ministry = {
    id: string;
    name: string;
    description: string;
    department: Department | string;
    departmentCode?: DepartmentCode | string;
    leaderId: string;
    headId?: string | null;
    approverId?: string | null;
    mealStubAssignerId?: string | null;
    mealStubWeeklyLimit?: number | null; // Total stubs allowed per week for this ministry
    weight?: number | null;
};

export type Department = 'Worship' | 'Outreach' | 'Relationship' | 'Discipleship' | 'Administration';
export type DepartmentCode = 'W' | 'O' | 'R' | 'D' | 'A';

export type DepartmentData = {
    id: Department;
    description?: string;
    headId?: string;
    mealStubTotalAllocation?: number;
};

export type MealStubSettings = {
    disabledVolunteerDays: number[]; // days of week 1-6
};

export type AttendanceRecord = {
    id: string;
    workerProfileId: string;
    type: "Clock In" | "Clock Out";
    time: TimestampLike | Date;
};

export type Booking = {
    id: string;
    requestId?: string;
    roomId: string;
    title: string;
    purpose?: string;
    start: TimestampLike | Date;
    end: TimestampLike | Date;
    status: 'Pending' | 'Pending Ministry Approval' | 'Pending Admin Approval' | 'Approved' | 'Rejected';
    workerProfileId: string;
    name: string;
    ministryId: string;
    email: string;
    requesterEmail?: string;
    dateRequested: TimestampLike | Date;
    pax: number;
    numTables?: number;
    numChairs?: number;
    equipment_TV?: boolean;
    equipment_Mic?: boolean;
    equipment_Speakers?: boolean;
    requestedElements?: string[]; // IDs of VenueElements requested
    guidelinesAccepted: boolean;
    checkedInAt?: TimestampLike | Date;
};

export type Room = {
    id: string;
    name: string;
    capacity: number;
    elements?: string[]; // Array of VenueElement IDs available in this room
    areaId: string;
    weight?: number;
    status?: 'Active' | 'Maintenance';
    numChairs?: number | null;
    numTables?: number | null;
};

export type Area = {
    id: string;
    name: string;
    branchId: string;
    areaId?: string;
};

export type Branch = {
    id: string;
    name: string;
};

export type MealStub = {
    id: string;
    workerId: string;
    workerName: string;
    date: TimestampLike | Date;
    status: 'Issued' | 'Claimed' | string;
    stubType?: string | null;
    assignedBy?: string | null;
    assignedByName?: string | null;
    claimedAt?: TimestampLike | Date | null;
};

export type VenueElement = {
    id: string;
    name: string;
    category: 'Equipment' | 'Manpower' | 'Other';
    providerMinistryId: string;
};

export type ApprovalRequest = {
    id?: string;
    requester: string;
    type: 'New Worker' | 'Profile Update' | 'Room Booking' | 'Ministry Change';
    details: string;
    date: TimestampLike | Date;
    status: 'Pending' | 'Pending Ministry Approval' | 'Pending Admin Approval' | 'Approved' | 'Rejected' | 'Pending Outgoing Approval' | 'Pending Incoming Approval';
    workerId?: string;
    roomId?: string;
    reservationId?: string;
    requestId?: string;
    oldMajorId?: string;
    newMajorId?: string;
    oldMinorId?: string;
    newMinorId?: string;
    outgoingApproved?: boolean;
    incomingApproved?: boolean;
};

export type ScanLog = {
    id: string;
    scannerId: string;
    scannerName: string;
    timestamp: TimestampLike | Date;
    scanType: 'Attendance' | 'Meal Stub' | 'Room Check-in';
    details: string;
    targetUserId?: string;
    targetUserName?: string;
    mealStubId?: string;
    reservationId?: string;
};

export type C2SMentee = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    status: 'In Progress' | 'Completed' | 'Dropped' | string;
    groupId: string;
    mentorId: string;
    createdAt: TimestampLike;
    group?: C2SGroup;
};

export type C2SGroup = {
    id: string;
    name: string;
    mentorId: string;
    menteeIds: string[];
    createdAt: TimestampLike;
    mentees?: C2SMentee[];
};

export type C2SDevotionRecord = {
    id: string;
    manualType?: string | null;
    moduleName?: string | null;
    lessonName?: string | null;
    topic: string;
    scripture?: string | null;
    devotionDate: TimestampLike;
    groupId?: string | null;
    clusterName?: string | null;
    mentorId: string;
    mentorName?: string | null;
    mentorRole?: string | null;
    mentorEmail?: string | null;
    userId?: string | null;
    attendeeNames: string[];
    attendeeCount: number;
    reflectionNotes: string;
    prayerRequests?: string | null;
    photoUrl?: string | null;
    photoUrls: string[];
    status: string;
    createdAt: TimestampLike;
    updatedAt: TimestampLike;
    group?: C2SGroup | null;
};

export type Inquiry = {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    message: string;
    type?: string | null;
    status: 'Pending' | 'In Review' | 'Responded' | 'Resolved' | 'Archived' | string;
    respondedAt?: TimestampLike | Date | null;
    respondedBy?: string | null;
    notes?: string | null;
    createdAt: TimestampLike | Date;
    updatedAt?: TimestampLike | Date;
};



