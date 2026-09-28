type PlaceholderPageProps = {
  title: string
}

export const PlaceholderPage = ({ title }: PlaceholderPageProps) => (
  <section className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-8">
    <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
    <p className="text-sm text-muted-foreground">Próximamente</p>
  </section>
)
