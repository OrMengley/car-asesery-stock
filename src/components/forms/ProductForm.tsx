"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
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
import { 
  Loading01Icon, 
  ImageAdd01Icon, 
  Delete01Icon,
  Package01Icon,
  BarcodeScanIcon,
  Dollar01Icon,
  TagsIcon,
  Image01Icon,
  MagicWand01Icon,
  Refresh01Icon
} from "hugeicons-react";
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
// heic2any is imported dynamically in the upload handler to avoid SSR 'window is not defined' errors
import type Heic2AnyType from "heic2any";

const CLOUDINARY_CLOUD_NAME = "dpap4mb1z";
const UPLOAD_PRESET = "products"; 

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
        
        const fileName = file.name;
        const extension = fileName.split('.').pop()?.toLowerCase();
        const isHEIC = extension === 'heic' || extension === 'heif' || extension === 'HEIC' || extension === 'HEIF' ||
                       file.type === 'image/heic' || file.type === 'image/heif';

        let isConverted = false;

        if (isHEIC) {
          const conversionToastId = toast.loading(`Converting HEIC: ${file.name}...`);
          try {
            // Dynamically import heic2any only on the client
            const heic2any = (await import("heic2any")).default as typeof Heic2AnyType;
            
            const blobForConversion = file.slice(0, file.size, file.type);
            const convertedBlob = await heic2any({
              blob: blobForConversion,
              toType: "image/jpeg",
              quality: 0.8
            });
            const resultBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
            const newFileName = file.name.replace(/\.(heic|heif)$/i, ".jpg");
            file = new File([resultBlob], newFileName, { type: "image/jpeg" });
            isConverted = true;
            toast.success(`Converted ${file.name} to JPG`, { id: conversionToastId });
          } catch (convError: any) {
            toast.error(`Could not convert ${file.name}. Uploading original.`, { id: conversionToastId });
          }
        }

        if (file.size > 1024 * 1024 && (!isHEIC || isConverted)) {
          const compressionOptions = {
            maxSizeMB: 1,
            maxWidthOrHeight: 1080,
            useWebWorker: true,
          };
          try {
            const compressedFile = await imageCompression(file, compressionOptions);
            file = new File([compressedFile], file.name, { type: file.type });
          } catch (compressionError: any) {
            console.error("Compression failed:", compressionError);
          }
        }

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
      toast.error(error.message || "Failed to upload images.");
    } finally {
      setUploading(false);
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
        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-6 p-6">
            {/* General Info */}
            <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 text-primary font-bold text-base mb-2">
                <MagicWand01Icon className="h-5 w-5" />
                General Information
              </div>

              <FormField<ProductFormValues, "name">
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 font-semibold">
                      <Package01Icon className="h-4 w-4 text-primary/70" />
                      Product Name
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Oil Filter, Brake Pad..."
                        className="h-12 bg-background border-primary/20 focus-visible:ring-primary text-base"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField<ProductFormValues, "barcode">
                  control={form.control}
                  name="barcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2 font-semibold">
                        <BarcodeScanIcon className="h-4 w-4 text-primary/70" />
                        Barcode
                      </FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input
                            placeholder="Scan or type..."
                            className="h-12 bg-background border-primary/20 focus-visible:ring-primary text-base"
                            {...field}
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={generateBarcode}
                          className="h-12 w-12 shrink-0 border-primary/20 hover:bg-primary/5 text-primary shadow-sm"
                          title="Generate random barcode"
                        >
                          <Refresh01Icon className="h-5 w-5" />
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
                      <FormLabel className="flex items-center gap-2 font-semibold">
                        <Dollar01Icon className="h-4 w-4 text-primary/70" />
                        Selling Price ($)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          className="h-12 bg-background border-primary/20 focus-visible:ring-primary text-base"
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
            <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 text-primary font-bold text-base mb-2">
                <TagsIcon className="h-5 w-5" />
                Categorization
              </div>

              <FormField<ProductFormValues, "category_id">
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12 bg-background border-primary/20 focus:ring-primary">
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
            <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary font-bold text-base">
                  <Image01Icon className="h-5 w-5" />
                  Product Gallery
                </div>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  Optimized
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {images.map((url, index) => (
                  <div
                    key={index}
                    className="relative aspect-square rounded-xl overflow-hidden border-2 border-primary/20 bg-background group shadow-md transition-all hover:ring-2 hover:ring-primary"
                  >
                    <Image 
                      src={url} 
                      alt="Product preview" 
                      fill 
                      className="object-cover" 
                      sizes="(max-width: 768px) 50vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="bg-destructive text-destructive-foreground p-2 rounded-full hover:bg-destructive/90 shadow-lg scale-90 group-hover:scale-100 transition-transform"
                      >
                        <Delete01Icon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ))}

                <label className="relative aspect-square rounded-xl border-2 border-dashed border-primary/20 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-primary/10 hover:border-primary/40 transition-all group overflow-hidden">
                  {uploading ? (
                    <Loading01Icon className="h-8 w-8 animate-spin text-primary z-10" />
                  ) : (
                    <>
                      <ImageAdd01Icon className="h-8 w-8 text-primary/50 group-hover:text-primary transition-all group-hover:scale-110 z-10" />
                      <span className="text-[10px] text-primary/60 font-bold uppercase tracking-widest z-10">
                        Add Media
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
          </div>
        </ScrollArea>
        
        {/* Fixed bottom actions */}
        <div className="p-6 border-t bg-muted/30 shrink-0">
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-primary hover:bg-primary/90 transition-all duration-300 shadow-lg shadow-primary/20"
          >
            {loading ? <Loading01Icon className="animate-spin h-5 w-5 mr-2" /> : <MagicWand01Icon className="h-5 w-5 mr-2" />}
            <span className="font-semibold tracking-wide uppercase">
              {initialData ? "Update Product" : "Create Product"}
            </span>
          </Button>
        </div>
      </form>
    </Form>
  );
}
