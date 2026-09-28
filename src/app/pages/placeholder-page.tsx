import { Card, CardContent } from "@/components/ui/card"

type PlaceholderPageProps = {
  title: string
}

export const PlaceholderPage = ({ title }: PlaceholderPageProps) => (
  <Card className="border border-dashed border-border bg-transparent ring-0 [--card-spacing:--spacing(8)]">
    <CardContent className="flex flex-col gap-2">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">Próximamente</p>
    </CardContent>
  </Card>
)
