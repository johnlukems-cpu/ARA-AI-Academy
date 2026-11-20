import { PlayCircle, FileText, BookOpen, ClipboardCheck, ListChecks, ExternalLink } from "lucide-react";
import type { LessonType } from "@/lib/types";

export const lessonIcons: Record<LessonType, typeof PlayCircle> = {
  video: PlayCircle,
  text: BookOpen,
  pdf: FileText,
  assignment: ClipboardCheck,
  quiz: ListChecks,
  external: ExternalLink,
};
