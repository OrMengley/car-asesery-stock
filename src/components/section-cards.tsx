import { ChartDecreaseIcon, ChartIncreaseIcon } from "hugeicons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function SectionCards() {
  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card className="@container/card relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <ChartIncreaseIcon className="size-16 text-primary" />
        </div>
        <CardHeader>
          <CardDescription className="text-muted-foreground/80 font-medium">Total Revenue</CardDescription>
          <CardTitle className="text-primary text-2xl font-bold tabular-nums @[250px]/card:text-3xl">
            $1,250.00
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center gap-1 px-1.5 py-0.5">
              <ChartIncreaseIcon className="size-3.5" />
              +12.5%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
            <ChartIncreaseIcon className="size-4" />
            <span>Trending up this month</span>
          </div>
          <div className="text-muted-foreground/70">
            Visitors for the last 6 months
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <ChartDecreaseIcon className="size-16 text-destructive" />
        </div>
        <CardHeader>
          <CardDescription className="text-muted-foreground/80 font-medium">New Customers</CardDescription>
          <CardTitle className="text-primary text-2xl font-bold tabular-nums @[250px]/card:text-3xl">
            1,234
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400 flex items-center gap-1 px-1.5 py-0.5">
              <ChartDecreaseIcon className="size-3.5" />
              -20%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex items-center gap-1.5 font-medium text-rose-600 dark:text-rose-400">
            <ChartDecreaseIcon className="size-4" />
            <span>Down 20% this period</span>
          </div>
          <div className="text-muted-foreground/70">
            Acquisition needs attention
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <ChartIncreaseIcon className="size-16 text-primary" />
        </div>
        <CardHeader>
          <CardDescription className="text-muted-foreground/80 font-medium">Active Accounts</CardDescription>
          <CardTitle className="text-primary text-2xl font-bold tabular-nums @[250px]/card:text-3xl">
            45,678
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center gap-1 px-1.5 py-0.5">
              <ChartIncreaseIcon className="size-3.5" />
              +12.5%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
            <ChartIncreaseIcon className="size-4" />
            <span>Strong user retention</span>
          </div>
          <div className="text-muted-foreground/70">Engagement exceed targets</div>
        </CardFooter>
      </Card>
      <Card className="@container/card relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <ChartIncreaseIcon className="size-16 text-primary" />
        </div>
        <CardHeader>
          <CardDescription className="text-muted-foreground/80 font-medium">Growth Rate</CardDescription>
          <CardTitle className="text-primary text-2xl font-bold tabular-nums @[250px]/card:text-3xl">
            4.5%
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center gap-1 px-1.5 py-0.5">
              <ChartIncreaseIcon className="size-3.5" />
              +4.5%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
            <ChartIncreaseIcon className="size-4" />
            <span>Steady performance increase</span>
          </div>
          <div className="text-muted-foreground/70">Meets growth projections</div>
        </CardFooter>
      </Card>
    </div>
  )
}
