"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  UserAdd01Icon, 
  PencilEdit01Icon, 
  Delete01Icon, 
  UserIcon, 
  Loading01Icon,
  Search01Icon,
  Sorting01Icon,
  Archive01Icon
} from "hugeicons-react";
import { getUsers, archiveUser, deleteUserPermanent } from "@/lib/firebase/actions";
import { User } from "@/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToProcess, setUserToProcess] = useState<User | null>(null);

  async function fetchUsers() {
    try {
      setLoading(true);
      const data = await getUsers();
      setUsers(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setSheetOpen(true);
  };

  const handleArchive = async () => {
    if (!userToProcess) return;
    try {
      await archiveUser(userToProcess.id);
      toast.success(`User ${userToProcess.name} archived successfully`);
      setArchiveDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error(error);
      toast.error("Failed to archive user");
    }
  };

  const handlePermanentDelete = async () => {
    if (!userToProcess) return;
    try {
      await deleteUserPermanent(userToProcess.id);
      toast.success(`User ${userToProcess.name} permanently deleted`);
      setDeleteDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete user permanently");
    }
  };

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-6 py-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <UserIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">User Management</h1>
            <p className="text-sm text-muted-foreground">Manage your team and access permissions</p>
          </div>
        </div>
        <Button 
          size="sm" 
          className="lg:hidden bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
          onClick={() => {
            setEditingUser(null);
            setSheetOpen(true);
          }}
        >
          <UserAdd01Icon className="mr-2 size-4" />
          Add User
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
        {/* Left Column: Quick Create Form */}
        <Card className="hidden lg:flex flex-col shadow-sm border-primary/10 max-h-[calc(100vh-160px)] overflow-hidden">
          <CardHeader className="shrink-0 bg-muted/30 pb-4 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <UserAdd01Icon className="size-5 text-primary" />
              Quick Create
            </CardTitle>
            <CardDescription>
              Add a new staff member to the system.
            </CardDescription>
          </CardHeader>
          
          <ScrollArea className="flex-1 overflow-y-auto">
            <CardContent className="pt-6">
              <UserForm onSuccess={() => {
                fetchUsers();
              }} />
            </CardContent>
          </ScrollArea>
        </Card>

        {/* Right Column: Data Table */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-bold text-xs uppercase tracking-wider">Name</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Username</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Role</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Created At</TableHead>
                <TableHead className="text-right font-bold text-xs uppercase tracking-wider">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-48">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loading01Icon className="animate-spin size-6 text-primary" />
                      <span className="text-sm font-medium">Fetching users...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-48 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <UserIcon className="size-8 opacity-20" />
                      <p>No users found.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} className="hover:bg-muted/30 transition-colors group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-sm tracking-tight">{user.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-medium">{user.username}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className={`font-semibold capitalize text-[10px] px-2 py-0.5 ${
                          user.role === "admin" 
                          ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" 
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                        }`}
                      >
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.created_at
                        ? format(user.created_at, "dd MMM yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" title="Edit User" className="size-8 text-primary hover:bg-primary/10" onClick={() => handleEdit(user)}>
                          <PencilEdit01Icon className="size-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          title="Archive User" 
                          className="size-8 text-amber-600 hover:bg-amber-100/50" 
                          onClick={() => {
                            setUserToProcess(user);
                            setArchiveDialogOpen(true);
                          }}
                        >
                          <Archive01Icon className="size-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          title="Permanent Delete" 
                          className="size-8 text-destructive hover:bg-destructive/10" 
                          onClick={() => {
                            setUserToProcess(user);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Delete01Icon className="size-4" />
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

      {/* Edit Sheet (and Mobile Create) */}
      <Sheet open={sheetOpen} onOpenChange={(val) => {
        setSheetOpen(val);
        if (!val) setEditingUser(null);
      }}>
        <SheetContent side="right" className="sm:max-w-[500px] p-0 flex flex-col overflow-hidden">
          <SheetHeader className="p-6 pb-2 shrink-0 bg-muted/20 border-b">
            <SheetTitle className="text-xl font-bold flex items-center gap-2">
              {editingUser ? <PencilEdit01Icon className="size-6 text-primary" /> : <UserAdd01Icon className="size-6 text-primary" />}
              {editingUser ? "Edit User Account" : "Add Team Member"}
            </SheetTitle>
            <SheetDescription>
              {editingUser ? "Update profile information and role permissions." : "Invite a new member to manage the stock system."}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-hidden flex flex-col">
            <UserForm 
              initialData={editingUser || undefined}
              onSuccess={() => {
                setSheetOpen(false);
                setEditingUser(null);
                fetchUsers();
              }} 
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Archive01Icon className="size-5 text-amber-600" />
              Archive User account?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will set <strong>{userToProcess?.name}</strong> as archived. They will no longer be able to access the system, but their historical data will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleArchive}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Archive User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Delete01Icon className="size-5 text-destructive" />
              Permanently delete user?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{userToProcess?.name}</strong>? This action cannot be undone and will remove all their information from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handlePermanentDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
