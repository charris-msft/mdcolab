export function Footer() {
  return (
    <footer className="border-t border-border px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-center text-sm text-muted-foreground">
        <p>Built with ❤️ for people who think in markdown</p>
        <span>&copy; {new Date().getFullYear()} mdcolab</span>
      </div>
    </footer>
  );
}
