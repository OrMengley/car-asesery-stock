"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createProduct, getCategories, updateProduct } from "@/lib/firebase/actions";
import { useEffect, useState } from "react";
import { Loader2, ImagePlus, X, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Category, Product } from "@/types";
import Image from "next/image";
import { buildImageUrl } from 'cloudinary-build-url';
import imageCompression from 'browser-image-compression';
import { Package, Barcode, DollarSign, Tag, Image as ImageIcon, Sparkles, RefreshCw } from "lucide-react";

const CLOUDINARY_CLOUD_NAME = "dpap4mb1z";
const UPLOAD_PRESET = "products"; // Change this to your actual unsigned upload preset

const formSchema = z.object({
  name: z.string().min(2, { message: "Product name is required." }),
  barcode: z.string().min(1, { message: "Barcode is required." }),
  price: z.coerce.number().min(0, "Price must be positive."),
  category_id: z.string().optional(),
  images: z.array(z.string()).default([]),
  thumbnails: z.array(z.string()).default([]),
});

type ProductFormValues = z.infer<typeof formSchema>;

interface ProductFormProps {
  initialData?: Product;
  onSuccess?: () => void;
}

export function ProductForm({ initialData, onSuccess }: ProductFormProps) {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [uploading, setUploading] = useState(false);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      name: initialData?.name || "",
      barcode: initialData?.barcode || "",
      price: initialData?.price || 0,
      category_id: initialData?.category_id || "",
      images: initialData?.images || [],
      thumbnails: initialData?.thumbnails || [],
    },
  });

  const generateBarcode = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const newBarcode = `PRO-${timestamp}${random}`;
    form.setValue("barcode", newBarcode, { shouldValidate: true });
    toast.info("New barcode generated");
  };

  const images = form.watch("images") || [];
  const thumbnails = form.watch("thumbnails") || [];

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const uploadedImages: string[] = [...images];
    const uploadedThumbnails: string[] = [...thumbnails];

    try {
      for (let i = 0; i < files.length; i++) {
        let file = files[i];
        
        // Compress image before upload
        const compressionOptions = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1080,
          useWebWorker: true,
        };

        try {
          const compressedFile = await imageCompression(file, compressionOptions);
          // Convert to File object if it's a Blob, to keep original name
          file = new File([compressedFile], file.name, { type: file.type });
        } catch (error) {
          console.error("Compression error:", error);
          // Fallback to original file if compression fails
        }

        // 1. Upload original image to 'products' folder
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", UPLOAD_PRESET);
        formData.append("folder", "products");
        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || "Upload failed");
        }

        const data = await response.json();
        const imageUrl = data.secure_url;
        
        // 2. Generate thumbnail URL using Cloudinary transformations
        // We use the same public_id but different transformations
        const thumbnailUrl = buildImageUrl(data.public_id, {
          cloud: {
            cloudName: CLOUDINARY_CLOUD_NAME,
          },
          transformations: {
            resize: {
              type: 'thumb',
              width: 250,
              height: 250,
              gravity: 'auto'
            },
            format: 'webp',
            quality: 'auto'
          },
        });

        uploadedImages.push(imageUrl);
        uploadedThumbnails.push(thumbnailUrl);
      }

      form.setValue("images", uploadedImages);
      form.setValue("thumbnails", uploadedThumbnails);
      toast.success(`${files.length} images uploaded successfully`);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to upload images. Check your upload preset.");
    } finally {
      setUploading(false);
      // Reset input value to allow uploading same file again
      e.target.value = "";
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    const newThumbnails = [...thumbnails];
    newImages.splice(index, 1);
    newThumbnails.splice(index, 1);
    form.setValue("images", newImages);
    form.setValue("thumbnails", newThumbnails);
  };

  useEffect(() => {
    async function loadCategories() {
      const data = await getCategories();
      setCategories(data);
    }
    loadCategories();
  }, []);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      const payload = {
        ...values,
        category_id: values.category_id === "none" ? undefined : values.category_id,
      };

      if (initialData?.id) {
        await updateProduct(initialData.id, payload);
        toast.success("Product updated successfully");
      } else {
        await createProduct(payload);
        toast.success("Product created successfully");
      }
      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error(error);
      toast.error(initialData?.id ? "Failed to update product" : "Failed to create product");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="flex-1 px-6">
          <div className="space-y-6 py-4">
        {/* General Info */}
        <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100/50 space-y-4">
          <div className="flex items-center gap-2 text-blue-600 font-medium text-sm mb-2">
            <Sparkles className="h-4 w-4" />
            General Information
          </div>

          <FormField<ProductFormValues, "name">
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  Product Name
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Oil Filter, Brake Pad..."
                    className="bg-background/50 border-blue-100 focus-visible:ring-blue-500"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField<ProductFormValues, "barcode">
              control={form.control}
              name="barcode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Barcode className="h-4 w-4 text-muted-foreground" />
                    Barcode
                  </FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input
                        placeholder="Scan or type..."
                        className="bg-background/50 border-blue-100 focus-visible:ring-blue-500"
                        {...field}
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={generateBarcode}
                      className="shrink-0 border-blue-100 hover:bg-blue-100/50 text-blue-600 shadow-sm"
                      title="Generate random barcode"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField<ProductFormValues, "price">
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    Selling Price ($)
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      className="bg-background/50 border-blue-100 focus-visible:ring-blue-500"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Categorization */}
        <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100/50 space-y-4">
          <div className="flex items-center gap-2 text-purple-600 font-medium text-sm mb-2">
            <Tag className="h-4 w-4" />
            Categorization
          </div>

          <FormField<ProductFormValues, "category_id">
            control={form.control}
            name="category_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-background/50 border-purple-100 focus:ring-purple-500">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Product Media */}
        <div className="space-y-4">
          {/* Main Images Showcase */}
          <div className="p-5 rounded-2xl bg-orange-50/50 border border-orange-100/50 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-orange-600 font-bold text-base">
                <ImageIcon className="h-5 w-5" />
                Main Showcase Gallery
              </div>
              <Badge variant="outline" className="bg-orange-100/50 text-orange-700 border-orange-200">
                Full Resolution
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {images.map((url, index) => (
                <div
                  key={index}
                  className="relative aspect-video rounded-xl overflow-hidden border-2 border-orange-200 bg-background group shadow-md transition-all hover:ring-2 hover:ring-orange-400"
                >
                  <Image src={url} alt="Product preview" fill className="object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="bg-destructive text-destructive-foreground p-2 rounded-full hover:bg-destructive/90 shadow-lg scale-90 group-hover:scale-100 transition-transform"
                      title="Remove image"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}

              <label className="relative aspect-video rounded-xl border-2 border-dashed border-orange-200 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-orange-100/50 hover:border-orange-400 transition-all group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                {uploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-orange-500 z-10" />
                ) : (
                  <>
                    <ImagePlus className="h-8 w-8 text-orange-400 group-hover:text-orange-600 transition-all group-hover:scale-110 z-10" />
                    <span className="text-[10px] text-orange-500 font-bold group-hover:text-orange-700 uppercase tracking-widest z-10">
                      Add Images
                    </span>
                  </>
                )}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={handleImageUpload}
                />
              </label>
            </div>
          </div>

          {/* Auto-Generated Thumbnails */}
          {thumbnails.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-50/50 border border-slate-200/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-600 font-bold text-xs uppercase tracking-tighter">
                  <Sparkles className="h-3.5 w-3.5" />
                  Auto-Optimized Thumbnails
                </div>
                <span className="text-[10px] text-slate-400 italic">For POS & Lists</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {thumbnails.map((url, index) => (
                  <div
                    key={index}
                    className="relative h-14 w-14 rounded-lg overflow-hidden border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100"
                  >
                    <Image
                      src={url}
                      alt="Thumbnail"
                      fill
                      className="object-cover grayscale-[20%] hover:grayscale-0 transition-all"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </ScrollArea>

    {/* Fixed bottom actions */}
    <div className="p-6 border-t bg-muted/30 shrink-0">
      <Button
        type="submit"
        disabled={loading}
        className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg shadow-blue-500/20"
      >
      {loading ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <Sparkles className="h-5 w-5 mr-2" />}
      <span className="font-semibold tracking-wide uppercase">
        {initialData ? "Update Product" : "Create Product"}
      </span>
    </Button>
  </div>
</form>
    </Form>
  );
}
