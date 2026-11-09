"use client";

import React, { useEffect, useRef, useState, Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import type { Room, Booking, Worker, Branch, Area } from "@studio/types";
import { format, isToday } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@studio/ui";
import {
  Calendar,
  Clock,
  DoorOpen,
  VideoOff,
  LoaderCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toJsDate } from "@/lib/utils";
import {
  getAreas,
  getBookings,
  getBranches,
  getRooms,
  getWorkers,
} from "@/actions/db";
import { handleBookingCheckIn } from "@/actions/venue-assistance";

const ClockComponent = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-3xl sm:text-4xl lg:text-5xl font-bold font-mono">
      {format(time, "h:mm:ss a")}
    </div>
  );
};

function RoomDisplayContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("roomId");
  const { data: rooms, isLoading: roomLoading } = useQuery({
    queryKey: ["rooms"],
    queryFn: () => getRooms(),
  });
  const room = rooms?.find((r) => r.id === roomId);

  const { data: areas, isLoading: areasLoading } = useQuery({
    queryKey: ["areas"],
    queryFn: () => getAreas(),
  });
  const { data: branches, isLoading: branchesLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: () => getBranches(),
  });
  const { data: allBookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ["bookings", { roomId, status: "Approved" }],
    queryFn: () =>
      getBookings({ roomId: roomId || undefined, status: "Approved" }),
    enabled: !!roomId,
  });
  const { data: workers, isLoading: workersLoading } = useQuery({
    queryKey: ["workers"],
    queryFn: () => getWorkers(),
  });

  const todaysBookings =
    allBookings
      ?.map((b) => ({ ...b, start: toJsDate(b.start), end: toJsDate(b.end) }))
      .filter((b) => isToday(b.start))
      .sort((a, b) => a.start.getTime() - b.start.getTime()) || [];

  const isLoading =
    roomLoading ||
    bookingsLoading ||
    workersLoading ||
    branchesLoading ||
    areasLoading;

  // Fire-and-forget check-in when a booking becomes active on this display.
  // Tracks the last checked-in bookingId to avoid duplicate calls.
  const checkedInBookingRef = useRef<string | null>(null);
  const now = new Date();
  const currentBookingForCheckIn = !isLoading
    ? todaysBookings.find((b) => now >= b.start && now <= b.end)
    : undefined;

  useEffect(() => {
    if (
      currentBookingForCheckIn &&
      currentBookingForCheckIn.id !== checkedInBookingRef.current
    ) {
      checkedInBookingRef.current = currentBookingForCheckIn.id;
      handleBookingCheckIn(currentBookingForCheckIn.id).catch(console.error);
    }
  }, [currentBookingForCheckIn?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const area = areas?.find((a) => a.areaId === room?.areaId);
  const branch = branches?.find((l) => l.id === area?.branchId);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
        <LoaderCircle className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  if (!roomId || !room) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <h1 className="text-4xl font-bold">
            {!roomId ? "No Room ID Provided" : "Room Not Found"}
          </h1>
          {!roomId && (
            <p className="text-gray-400 mt-2">
              Please provide a roomId in the URL parameters.
            </p>
          )}
        </div>
      </div>
    );
  }

  const currentBooking = currentBookingForCheckIn;
  const nextBooking = todaysBookings.find((b) => now < b.start);

  const qrCodeUrl = currentBooking
    ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`ROOM_CHECKIN:${currentBooking.id}`)}&bgcolor=374151&color=ffffff&qzone=1`
    : "";

  const getUserName = (userId: string) => {
    const user = (workers as any[])?.find((w: any) => w.id === userId);
    return user ? `${user.firstName} ${user.lastName}` : userId;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-8 flex flex-col">
      <header className="flex flex-col sm:flex-row justify-between items-start mb-8 gap-4">
        <div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-headline">
            {room.name}
          </h1>
          {(branch || area) && (
            <p className="text-xl sm:text-2xl text-gray-300">
              {branch?.name}
              {branch && area && " / "}
              {area?.name}
            </p>
          )}
          <p className="text-lg sm:text-xl lg:text-2xl text-gray-400 flex items-center gap-2 mt-2">
            <Calendar className="h-6 w-6" />
            {format(new Date(), "EEEE, MMMM do")}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <ClockComponent />
        </div>
      </header>

      <main className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
        <Card
          className={`md:col-span-2 bg-gray-800 border-2 border-gray-700 text-white flex flex-col justify-center items-center p-4 ${currentBooking ? "border-red-500" : "border-green-500"}`}
        >
          <CardHeader className="items-center text-center">
            <CardTitle className="text-3xl lg:text-4xl font-headline mb-2">
              {currentBooking ? "Room in Use" : "Room Available"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center w-full">
            {currentBooking ? (
              <div className="flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-8 w-full">
                <div className="text-center lg:text-left">
                  <p className="text-2xl lg:text-3xl font-semibold">
                    {currentBooking.title}
                  </p>
                  <p className="text-xl lg:text-2xl text-gray-300 mt-2">
                    {format(currentBooking.start, "h:mm a")} -{" "}
                    {format(currentBooking.end, "h:mm a")}
                  </p>
                  <p className="text-lg lg:text-xl text-gray-400 mt-1">
                    Booked by{" "}
                    {getUserName((currentBooking as any).workerProfileId)}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-2 p-4 bg-gray-700 rounded-lg mt-4 lg:mt-0">
                  <Image
                    src={qrCodeUrl}
                    alt="Check-in QR Code"
                    width={200}
                    height={200}
                    className="rounded-md"
                  />
                  <p className="text-sm text-gray-300 font-semibold mt-2">
                    Scan to Check In
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-8">
                <DoorOpen className="h-16 w-16 md:h-24 md:w-24 text-green-400" />
                {nextBooking ? (
                  <p className="text-lg md:text-xl text-gray-300 mt-4">
                    Next booking at {format(nextBooking.start, "h:mm a")}
                  </p>
                ) : (
                  <p className="text-lg md:text-xl text-gray-300 mt-4">
                    No more bookings for today
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="bg-gray-800 border-gray-700 text-white">
          <CardHeader>
            <CardTitle className="font-headline text-2xl lg:text-3xl">
              Today's Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todaysBookings.length > 0 ? (
              <div className="space-y-4">
                {todaysBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className={`p-4 rounded-lg flex items-start gap-4 ${now >= booking.start && now <= booking.end ? "bg-red-900/50" : now > booking.end ? "bg-gray-700 opacity-60" : "bg-gray-700/50"}`}
                  >
                    <Clock className="h-5 w-5 mt-1 text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">{booking.title}</p>
                      <p className="text-sm text-gray-300">
                        {format(booking.start, "h:mm a")} -{" "}
                        {format(booking.end, "h:mm a")}
                      </p>
                      <p className="text-xs text-gray-400">
                        by {getUserName((booking as any).workerProfileId)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 py-10">
                <VideoOff className="h-12 w-12 md:h-16 md:h-16 mb-4" />
                <p>No bookings for today.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function RoomDisplayPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
          <LoaderCircle className="h-12 w-12 animate-spin" />
        </div>
      }
    >
      <RoomDisplayContent />
    </Suspense>
  );
}
