import React, { useEffect, useState } from "react";
import { quizService } from "../services/api/quiz/quizService";
import {
  CalendarBody,
  CalendarDate,
  CalendarDatePagination,
  CalendarDatePicker,
  CalendarHeader,
  CalendarItem,
  CalendarMonthPicker,
  CalendarProvider,
  CalendarYearPicker,
  Feature
} from "../components/ui/calendar";
import {
  addMonths,
  endOfMonth,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";

const today = new Date();

const statusColors = {
  Scheduled: "#6B7280",
  Active: "#10B981",
  Completed: "#F59E0B"
};

// The calendar features will be populated dynamically from the backend

const earliestYear = new Date().getFullYear() - 1;
const latestYear = new Date().getFullYear() + 2;

const CalendarPage: React.FC = () => {
  const [msg, setMsg] = useState("");
  const [quizzes, setQuizzes] = useState<Feature[]>([]);

  useEffect(() => {
    const fetchCalendar = async () => {
      try {
        const res = await quizService.getAllQuizzes();
        const mappedQuizzes: Feature[] = res.map((q: any) => {
          const createdAt = new Date(q.createdAt);
          const endAt = new Date(createdAt.getTime() + 60 * 60 * 1000); // Set end time to 1 hour after creation

          let statusName = "Scheduled";
          let color = statusColors.Scheduled;

          if (q.attemptCount > 0) {
            statusName = "Completed";
            color = statusColors.Completed;
          } else if (q.isActive) {
            statusName = "Active";
            color = statusColors.Active;
          }

          return {
            id: q.id.toString(),
            name: q.title,
            startAt: createdAt,
            endAt: endAt,
            status: { id: statusName, name: statusName, color }
          };
        });
        setQuizzes(mappedQuizzes);
        setMsg(`Loaded ${mappedQuizzes.length} scheduled quizzes.`);
      } catch (e) {
        console.error(e);
        setMsg("Failed to load calendar events.");
      }
    };
    fetchCalendar();
  }, []);

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden max-w-[1600px] mx-auto w-full">
      <div className="flex flex-col gap-2 mb-6 flex-shrink-0">
          <h1 className="text-3xl font-bold text-foreground font-heading">Calendar</h1>
          <p className="text-muted-foreground">Schedule and track your upcoming quizzes.</p>
          {msg && (
            <div className="mt-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 p-3 rounded-xl text-sm border border-blue-200 dark:border-blue-800 self-start">
              {msg}
            </div>
          )}
      </div>
      
      <div className="flex-1 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-0">
        <CalendarProvider className="h-full flex flex-col">
            <CalendarDate>
                <CalendarDatePicker>
                    <CalendarMonthPicker className="w-40" />
                    <CalendarYearPicker start={earliestYear} end={latestYear} className="w-32" />
                </CalendarDatePicker>
                <CalendarDatePagination />
            </CalendarDate>
            <CalendarHeader />
            <CalendarBody features={quizzes} children={({ feature }) => <CalendarItem key={feature.id} feature={feature} />} />
        </CalendarProvider>
      </div>
    </div>
  );
};

export default CalendarPage;