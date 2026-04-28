import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { FaqItem } from "@/lib/supabase/types";

interface FaqAccordionProps {
  items: Pick<FaqItem, "id" | "question" | "answer">[];
}

export default function FaqAccordion({ items }: FaqAccordionProps) {
  if (!items.length) return null;

  return (
    <Accordion multiple={false} className="w-full space-y-2">
      {items.map((item, i) => (
        <AccordionItem
          key={item.id}
          value={`item-${i}`}
          className="border border-border rounded-lg px-4 data-open:border-primary/40 transition-colors"
        >
          <AccordionTrigger className="text-sm font-medium py-4 hover:no-underline hover:text-primary text-left">
            {item.question}
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4 whitespace-pre-wrap">
            {item.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
