import { Badge } from "@/components/ui/badge";

export function TeacherReviewStatus({ count }: { count: number }) {
  return count > 0
    ? <Badge tone="amber">Teacher review required</Badge>
    : <Badge tone="green">No review needed</Badge>;
}
