"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { UserPlus, Pencil, Trash2 } from "lucide-react";
import { getUsers, archiveUser } from "@/lib/firebase/actions";
import { User } from "@/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserForm } from "@/components/forms/UserForm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  async function fetchUsers() {
    try {
      setLoading(true);
      const data = await getUsers();
      setUsers(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this user?")) {
      try {
        await archiveUser(id);
        toast.success("User deleted successfully");
        fetchUsers();
      } catch (error) {
        console.error(error);
        toast.error("Failed to delete user");
      }
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold md:text-2xl">Users</h1>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="sm" className="bg-primary hover:bg-primary/90 shadow-md">
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </SheetTrigger>
          <SheetContent 
            side="bottom" 
            className="sm:max-w-[700px] mx-auto rounded-t-[2.5rem] border-x-0 sm:border-x border-t shadow-2xl bg-background px-6 pb-10 pt-2 h-auto max-h-[95vh] overflow-hidden flex flex-col"
          >
            <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-4 mt-2" />
            <SheetHeader className="pb-4">
              <SheetTitle className="text-2xl font-bold text-center">Create New User</SheetTitle>
              <SheetDescription className="text-center">
                Add a new member to your team.
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className="flex-1 min-h-0 px-4 pr-6">
              <div className="py-4">
                <UserForm onSuccess={() => {
                  setOpen(false);
                  fetchUsers();
                }} />
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>

      <div className="rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">
                  Loading...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.created_at
                      ? format(user.created_at, "MMM dd, yyyy")
                      : "Just now"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                       <Button size="sm" variant="ghost">
                         <Pencil className="h-4 w-4 text-blue-600" />
                       </Button>
                       <Button size="sm" variant="ghost" onClick={() => handleDelete(user.id)}>
                         <Trash2 className="h-4 w-4 text-destructive" />
                       </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
