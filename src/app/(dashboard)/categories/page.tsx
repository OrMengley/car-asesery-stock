"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { getCategories, archiveCategory } from "@/lib/firebase/actions";
import { toast } from "sonner";
import { Category } from "@/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CategoryForm } from "@/components/forms/CategoryForm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  async function fetchCategories() {
    try {
      setLoading(true);
      const data = await getCategories();
      setCategories(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to archive this category?")) {
      try {
        await archiveCategory(id);
        toast.success("Category archived");
        fetchCategories();
      } catch (error) {
        toast.error("Failed to archive category");
      }
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold md:text-2xl">Categories</h1>
        <Sheet open={open} onOpenChange={(val) => {
          setOpen(val);
          if (!val) setEditingCategory(null);
        }}>
          <SheetTrigger asChild>
            <Button size="sm" className="bg-primary hover:bg-primary/90 shadow-md" onClick={() => setEditingCategory(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          </SheetTrigger>
          <SheetContent 
            side="bottom" 
            className="sm:max-w-[700px] mx-auto rounded-t-[2.5rem] border-x-0 sm:border-x border-t shadow-2xl bg-background px-6 pb-10 pt-2 h-auto max-h-[95vh] overflow-hidden flex flex-col"
          >
            <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-4 mt-2" />
            <SheetHeader className="pb-4">
              <SheetTitle className="text-2xl font-bold text-center">
                {editingCategory ? "Edit Category" : "Create New Category"}
              </SheetTitle>
              <SheetDescription className="text-center">
                {editingCategory ? "Update category details." : "Categorize your products for better organization."}
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className="flex-1 min-h-0 px-4 pr-6">
              <div className="py-4">
                <CategoryForm 
                  initialData={editingCategory || undefined}
                  onSuccess={() => {
                    setOpen(false);
                    setEditingCategory(null);
                    fetchCategories();
                  }} 
                />
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
              <TableHead>Created At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center h-24">
                  Loading...
                </TableCell>
              </TableRow>
            ) : categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                  No categories found.
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell>
                    {category.created_at
                      ? format(category.created_at, "MMM dd, yyyy")
                      : "Just now"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                       <Button size="sm" variant="ghost" onClick={() => handleEdit(category)}>
                         <Pencil className="h-4 w-4 text-blue-600" />
                       </Button>
                       <Button size="sm" variant="ghost" onClick={() => handleDelete(category.id)}>
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
