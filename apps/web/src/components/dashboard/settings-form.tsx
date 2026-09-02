"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { updateProfile } from "@/app/dashboard/settings/actions";

const settingsSchema = z.object({
  fullName: z.string().trim().min(1, "Name can't be empty."),
  phone: z.string().trim().optional(),
  emailAlerts: z.boolean(),
  emailMaintenanceUpdates: z.boolean(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

/** react-hook-form + zod driving the same `updateProfile` server action and
 *  field names as before — just client-validated first (empty name never
 *  reaches the server), and the two notification checkboxes are now real
 *  Switches. `updateProfile` always ends in a redirect (success or error,
 *  both as query params back on this page), so there's no "then what"
 *  branch after calling it — this component's job ends at the call. */
export function SettingsForm({
  fullName,
  phone,
  email,
  emailAlerts,
  emailMaintenanceUpdates,
}: {
  fullName: string;
  phone: string;
  email: string;
  emailAlerts: boolean;
  emailMaintenanceUpdates: boolean;
}) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { fullName, phone, emailAlerts, emailMaintenanceUpdates },
  });

  async function onSubmit(data: SettingsFormValues) {
    setIsSubmitting(true);
    const formData = new FormData();
    formData.set("fullName", data.fullName);
    formData.set("phone", data.phone ?? "");
    if (data.emailAlerts) formData.set("emailAlerts", "on");
    if (data.emailMaintenanceUpdates) formData.set("emailMaintenanceUpdates", "on");
    await updateProfile(formData);
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-6 rounded-xl border border-border bg-card p-5"
    >
      <FieldGroup>
        <Field data-invalid={!!form.formState.errors.fullName}>
          <FieldLabel htmlFor="fullName">Full name</FieldLabel>
          <FieldContent>
            <Input id="fullName" {...form.register("fullName")} />
            <FieldError errors={[form.formState.errors.fullName]} />
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="phone">Phone</FieldLabel>
          <FieldContent>
            <Input id="phone" {...form.register("phone")} />
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel>Email</FieldLabel>
          <FieldDescription>{email} (contact support to change)</FieldDescription>
        </Field>

        <FieldSeparator>Notification preferences</FieldSeparator>

        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="emailAlerts">Device alerts</FieldLabel>
            <FieldDescription>Email me about device alerts.</FieldDescription>
          </FieldContent>
          <Switch
            id="emailAlerts"
            checked={form.watch("emailAlerts")}
            onCheckedChange={(checked) => form.setValue("emailAlerts", checked)}
          />
        </Field>

        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="emailMaintenanceUpdates">Maintenance updates</FieldLabel>
            <FieldDescription>Email me about maintenance request updates.</FieldDescription>
          </FieldContent>
          <Switch
            id="emailMaintenanceUpdates"
            checked={form.watch("emailMaintenanceUpdates")}
            onCheckedChange={(checked) => form.setValue("emailMaintenanceUpdates", checked)}
          />
        </Field>
      </FieldGroup>

      <Button type="submit" size="sm" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Save Changes"}
      </Button>
    </form>
  );
}
