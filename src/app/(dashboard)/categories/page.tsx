"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Add01Icon, 
  PencilEdit01Icon, 
  Delete01Icon, 
  GridViewIcon,
  Loading01Icon
} from "hugeicons-react";
import { getCategories, archiveCategory } from "@/lib/firebase/actions";
import { toast } from "sonner";
import { Category } from "@/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
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
    setSheetOpen(true);
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
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GridViewIcon className="size-6 text-primary" />
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">Category Management</h1>
        </div>
        <Button 
          size="sm" 
          className="lg:hidden bg-primary hover:bg-primary/90 shadow-md"
          onClick={() => {
            setEditingCategory(null);
            setSheetOpen(true);
          }}
        >
          <Add01Icon className="mr-2 size-4" />
          Add Category
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
        {/* Left Column: Create Form (Hidden on Mobile) */}
        <Card className="hidden lg:block shadow-sm border-primary/10">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Add01Icon className="size-5 text-primary" />
              Quick Create
            </CardTitle>
            <CardDescription>
              Add a new category to organize your products.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryForm 
              onSuccess={() => {
                fetchCategories();
              }} 
            />
          </CardContent>
        </Card>

        {/* Right Column: Data Table */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="font-bold">Name</TableHead>
                <TableHead className="font-bold">Created At</TableHead>
                <TableHead className="text-right font-bold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center h-48">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loading01Icon className="animate-spin size-6" />
                      <span>Loading categories...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center h-48 text-muted-foreground">
                    No categories found.
                  </TableCell>
                </TableRow>
              ) : (
                categories.map((category) => (
                  <TableRow key={category.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {category.created_at
                        ? format(category.created_at, "MMM dd, yyyy")
                        : "Just now"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                         <Button size="icon" variant="ghost" className="size-8 text-primary hover:text-primary hover:bg-primary/10" onClick={() => handleEdit(category)}>
                           <PencilEdit01Icon className="size-4" />
                         </Button>
                         <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(category.id)}>
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

      {/* Edit Sheet (still useful for editing) */}
      <Sheet open={sheetOpen} onOpenChange={(val) => {
        setSheetOpen(val);
        if (!val) setEditingCategory(null);
      }}>
        <SheetContent 
          side="right" 
          className="sm:max-w-[450px] bg-background px-6 pb-10 pt-6 flex flex-col gap-6"
        >
          <SheetHeader>
            <SheetTitle className="text-xl font-bold flex items-center gap-2">
              {editingCategory ? (
                <PencilEdit01Icon className="size-5 text-primary" />
              ) : (
                <Add01Icon className="size-5 text-primary" />
              )}
              {editingCategory ? "Edit Category" : "Create New Category"}
            </SheetTitle>
            <SheetDescription>
              {editingCategory ? "Update the category name and details." : "Add a new category to organize your products."}
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 -mx-2 px-2">
            <CategoryForm 
              initialData={editingCategory || undefined}
              onSuccess={() => {
                setSheetOpen(false);
                setEditingCategory(null);
                fetchCategories();
              }} 
            />
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
