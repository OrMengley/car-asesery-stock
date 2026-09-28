"use client"

import { useEffect, useState, useMemo } from "react"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { SectionCards } from "@/components/section-cards"
import { DashboardRecentInvoices } from "@/components/dashboard-recent-invoices"
import { DashboardInventoryHighlights } from "@/components/dashboard-inventory-highlights"
import { getSaleInvoices } from "@/lib/firebase/sale-actions"
import { getProducts, getCategories } from "@/lib/firebase/actions"
import { getStocks } from "@/lib/firebase/stock-actions"
import { getCustomers } from "@/lib/firebase/customer-actions"
import { Product, Stock, SaleInvoice, Customer, Category } from "@/types"

export default function DashboardPage() {
  const [invoices, setInvoices] = useState<SaleInvoice[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [stocks, setStocks] = useState<Stock[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true)
        const [invs, prods, stks, custs, cats] = await Promise.all([
          getSaleInvoices(),
          getProducts(),
          getStocks(),
          getCustomers(),
          getCategories(),
        ])
        setInvoices(invs)
        setProducts(prods)
        setStocks(stks)
        setCustomers(custs)
        setCategories(cats)
      } catch (err) {
        console.error("Failed to load dashboard live data", err)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [])

  // Calculate high-level summary metrics
  const metrics = useMemo(() => {
    let totalRevenue = 0
    let paidOrders = 0
    let unpaidOrders = 0
    let unpaidAmount = 0

    const now = new Date()
    const curYear = now.getFullYear()
    const curMonth = now.getMonth()

    const lastMonthDate = new Date(curYear, curMonth - 1, 1)
    const lastMonthYear = lastMonthDate.getFullYear()
    const lastMonthMonth = lastMonthDate.getMonth()

    let thisMonthRevenue = 0
    let lastMonthRevenue = 0

    invoices.forEach((inv) => {
      const amt = Number(inv.total_price || 0)
      totalRevenue += amt

      if (inv.status === "paid") {
        paidOrders += 1
      } else {
        unpaidOrders += 1
        unpaidAmount += amt
      }

      if (inv.created_at) {
        const d = new Date(inv.created_at)
        if (!isNaN(d.getTime())) {
          if (d.getFullYear() === curYear && d.getMonth() === curMonth) {
            thisMonthRevenue += amt
          } else if (d.getFullYear() === lastMonthYear && d.getMonth() === lastMonthMonth) {
            lastMonthRevenue += amt
          }
        }
      }
    })

    const revenueGrowth =
      lastMonthRevenue > 0
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : thisMonthRevenue > 0
        ? 100
        : 0

    // Stock & Inventory Calculations
    const productStockMap = new Map<string, number>()
    let totalStockUnits = 0
    let inventoryValue = 0

    stocks.forEach((s) => {
      const qty = Number(s.quantity || 0)
      const cost = Number(s.cost || 0)
      totalStockUnits += qty
      inventoryValue += qty * cost

      const current = productStockMap.get(s.product_id) || 0
      productStockMap.set(s.product_id, current + qty)
    })

    let lowStockCount = 0
    let outOfStockCount = 0

    products.forEach((p) => {
      const stock = productStockMap.get(p.id) ?? 0
      if (stock <= 0) {
        outOfStockCount += 1
        lowStockCount += 1
      } else if (stock <= 5) {
        lowStockCount += 1
      }
    })

    return {
      totalRevenue,
      revenueGrowth,
      totalOrders: invoices.length,
      paidOrders,
      unpaidOrders,
      unpaidAmount,
      totalStockUnits,
      totalProducts: products.length,
      inventoryValue,
      lowStockCount,
      outOfStockCount,
    }
  }, [invoices, products, stocks])

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      {/* 1. Metric Overview Cards */}
      <SectionCards
        totalRevenue={metrics.totalRevenue}
        revenueGrowth={metrics.revenueGrowth}
        totalOrders={metrics.totalOrders}
        paidOrders={metrics.paidOrders}
        unpaidOrders={metrics.unpaidOrders}
        unpaidAmount={metrics.unpaidAmount}
        totalStockUnits={metrics.totalStockUnits}
        totalProducts={metrics.totalProducts}
        inventoryValue={metrics.inventoryValue}
        lowStockCount={metrics.lowStockCount}
        outOfStockCount={metrics.outOfStockCount}
        loading={loading}
      />

      {/* 2. Interactive Chart */}
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive invoices={invoices} loading={loading} />
      </div>

      {/* 3. Bottom Grid: Recent Invoices (left) & Inventory Highlights (right) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 px-4 lg:px-6">
        <div className="xl:col-span-2">
          <DashboardRecentInvoices
            invoices={invoices}
            customers={customers}
            loading={loading}
          />
        </div>
        <div className="xl:col-span-1">
          <DashboardInventoryHighlights
            products={products}
            stocks={stocks}
            invoices={invoices}
            loading={loading}
          />
        </div>
      </div>
    </div>
  )
}

