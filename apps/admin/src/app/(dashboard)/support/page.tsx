// The right side while no ticket is open (the list is in the layout): how the team works a ticket, so anyone who opens the page knows the rules.
const STEPS = [
  { title: "Take it", text: "A new ticket goes to the whole team of its site: the installer, the site's employees and the admins. Open it and press Take this ticket, or just answer it: answering takes it." },
  { title: "Hand it over", text: "Not yours to fix? Choose a person in Hand it to someone else. They are e-mailed, and so is the customer." },
  { title: "Write to the customer", text: "Replies reach the customer in the app and by e-mail if they have not read them. Tick Internal note to leave a message only your team sees." },
  { title: "Resolve, then close", text: "Mark resolved asks the customer to confirm. When they close it they can rate you: ratings show on the ticket." },
];

export default function SupportEmpty() {
  return (
    <div className="flex h-full min-h-[18rem] flex-col justify-center rounded-2xl border border-dashed border-border bg-card/40 p-8 max-lg:hidden">
      <h2 className="text-lg font-semibold">Pick a ticket</h2>
      <p className="mt-1 max-w-xl text-sm text-muted-foreground">Choose one on the left to read the conversation, take it or hand it over. Here is how it works:</p>
      <ol className="mt-5 grid max-w-3xl gap-4 sm:grid-cols-2">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">{i + 1}</span>
            <div>
              <p className="text-sm font-medium">{s.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
