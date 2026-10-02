import { Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { deleteTaskAction, toggleTaskAction } from "./actions";
import type { TaskDTO } from "./schema";

export function TaskTable({ tasks }: { tasks: TaskDTO[] }) {
  if (tasks.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No tasks yet. Add your first one above.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-24">Done</TableHead>
          <TableHead>Title</TableHead>
          <TableHead className="w-16 text-right">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => (
          <TableRow key={task.id}>
            <TableCell>
              <form action={toggleTaskAction.bind(null, task.id)}>
                <Button type="submit" variant={task.done ? "secondary" : "outline"} size="sm">
                  {task.done ? "Undo" : "Done"}
                </Button>
              </form>
            </TableCell>
            <TableCell className={task.done ? "text-muted-foreground line-through" : undefined}>
              {task.title}
            </TableCell>
            <TableCell className="text-right">
              <form action={deleteTaskAction.bind(null, task.id)}>
                <Button type="submit" variant="ghost" size="icon" aria-label={`Delete ${task.title}`}>
                  <Trash2Icon className="size-4" />
                </Button>
              </form>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
