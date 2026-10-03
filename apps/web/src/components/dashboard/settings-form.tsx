"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
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
import { ButtonSpinner } from "@/components/ui/spinner";
import { withPromiseToast } from "@waytara/ui/notify";
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
 *  Switches. `updateProfile` reports its outcome by resolving or throwing
 *  (no more redirect-with-a-query-param) — `withPromiseToast` turns that
 *  into a loading → success/error toast. */
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
  // useWatch, not form.watch() called inline in JSX — a real hook
  // subscription React Compiler can track, rather than a plain function
  // call whose return value it has to treat as unmemoizable every render.
  const watchedEmailAlerts = useWatch({ control: form.control, name: "emailAlerts" });
  const watchedEmailMaintenanceUpdates = useWatch({ control: form.control, name: "emailMaintenanceUpdates" });

  async function onSubmit(data: SettingsFormValues) {
    setIsSubmitting(true);
    const formData = new FormData();
    formData.set("fullName", data.fullName);
    formData.set("phone", data.phone ?? "");
    if (data.emailAlerts) formData.set("emailAlerts", "on");
    if (data.emailMaintenanceUpdates) formData.set("emailMaintenanceUpdates", "on");
    await withPromiseToast(updateProfile, { loading: "Saving…", success: "Settings saved." })(formData);
    setIsSubmitting(false);
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
            checked={watchedEmailAlerts}
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
            checked={watchedEmailMaintenanceUpdates}
            onCheckedChange={(checked) => form.setValue("emailMaintenanceUpdates", checked)}
          />
        </Field>
      </FieldGroup>

      <Button type="submit" size="sm" disabled={isSubmitting}>
        <ButtonSpinner show={isSubmitting} />
        {isSubmitting ? "Saving…" : "Save Changes"}
      </Button>
    </form>
  );
}
