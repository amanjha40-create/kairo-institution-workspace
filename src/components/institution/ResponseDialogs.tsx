import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { CandidateClaim } from "@/lib/institution/types";

const DISCREPANCY_FIELDS = [
  "Student identity",
  "Student ID",
  "Degree",
  "Programme",
  "Department",
  "Admission period",
  "Graduation period",
  "Completion status",
  "Record not found",
  "Other",
];

const CLARIFICATION_FIELDS = [
  "Student ID",
  "Degree",
  "Programme",
  "Department",
  "Admission year",
  "Graduation year",
  "Supporting document",
];

export function ConfirmDialog({
  open,
  claim,
  submitting = false,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  claim: CandidateClaim;
  submitting?: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (note: string) => void;
}) {
  const [ack, setAck] = useState(false);
  const [note, setNote] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm education record</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-md border border-border bg-secondary/60 p-3 text-xs">
            <div className="font-medium text-foreground">You are confirming:</div>
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              <li>Candidate: {claim.candidateName}</li>
              <li>Student ID: {claim.studentId ?? "—"}</li>
              <li>Degree: {claim.degree}</li>
              <li>Programme: {claim.programme}</li>
              <li>Graduation year: {claim.graduationYear}</li>
              <li>Completion status: {claim.completionStatus}</li>
            </ul>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={ack} onCheckedChange={(v) => setAck(!!v)} />
            <span>
              I confirm that the information selected above matches the institution's records.
            </span>
          </label>
          <div>
            <Label className="text-xs">Optional external note</Label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button disabled={!ack || submitting} onClick={() => onSubmit(note)}>
            {submitting ? "Submitting…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DiscrepancyDialog({
  open,
  submitting = false,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  submitting?: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (fields: string[], explanation: string) => void;
}) {
  const [fields, setFields] = useState<string[]>([]);
  const [explanation, setExplanation] = useState("");
  const toggle = (f: string) =>
    setFields((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Report discrepancy</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label className="text-xs">Which fields differ?</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {DISCREPANCY_FIELDS.map((f) => (
                <label key={f} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={fields.includes(f)} onCheckedChange={() => toggle(f)} />
                  <span>{f}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Short explanation</Label>
            <Textarea
              rows={3}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Describe the factual difference."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            disabled={fields.length === 0 || explanation.trim().length === 0 || submitting}
            onClick={() => onSubmit(fields, explanation)}
          >
            {submitting ? "Submitting…" : "Report discrepancy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ClarificationDialog({
  open,
  submitting = false,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  submitting?: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (fields: string[], message: string, requestDocument: boolean) => void;
}) {
  const [fields, setFields] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [reqDoc, setReqDoc] = useState(false);
  const toggle = (f: string) =>
    setFields((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request clarification</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label className="text-xs">What information is missing?</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {CLARIFICATION_FIELDS.map((f) => (
                <label key={f} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={fields.includes(f)} onCheckedChange={() => toggle(f)} />
                  <span>{f}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Message</Label>
            <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={reqDoc} onCheckedChange={(v) => setReqDoc(!!v)} />
            <span>Request a supporting document</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            disabled={fields.length === 0 || message.trim().length === 0 || submitting}
            onClick={() => onSubmit(fields, message, reqDoc)}
          >
            {submitting ? "Submitting…" : "Send clarification request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
