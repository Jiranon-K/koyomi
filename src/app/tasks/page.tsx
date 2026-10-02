import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskForm } from "@/features/tasks/task-form";
import { TaskTable } from "@/features/tasks/task-table";
import { listTasks } from "@/features/tasks/service";
import type { TaskDTO } from "@/features/tasks/schema";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tasks" };

export default async function TasksPage() {
  let tasks: TaskDTO[] = [];
  let dbError = false;
  try {
    tasks = await listTasks();
  } catch {
    dbError = true;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Home
        </Link>
        <ThemeToggle />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
          <CardDescription>Example feature: UI, Server Actions, Mongoose and MongoDB. Delete it when you start your own.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <TaskForm />
          {dbError ? (
            <p role="alert" className="text-sm text-destructive">
              Cannot reach MongoDB. Start it and check MONGODB_URI in .env.local.
            </p>
          ) : (
            <TaskTable tasks={tasks} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
