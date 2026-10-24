import { adminJsonRoute, adminRoute } from "@/lib/api/handlers";
import {
  deleteMessage,
  updateMessageStatus,
} from "@/lib/services/contact.service";
import { updateMessageStatusSchema } from "@/lib/validations/contact.validation";

const MESSAGE_TAGS = ["admin-messages"] as const;

type Params = { id: string };

/**
 * PATCH /api/admin/messages/[id]
 *
 * Admin only. Flip a message between NEW / READ / ARCHIVED.
 */
export const PATCH = adminJsonRoute<
  typeof updateMessageStatusSchema,
  unknown,
  Params
>({
  schema: updateMessageStatusSchema,
  scope: "admin.messages/[id].PATCH",
  revalidate: MESSAGE_TAGS,
  handler: async ({ body, params }) => {
    const message = await updateMessageStatus(params.id, body);
    return { data: message };
  },
});

/**
 * DELETE /api/admin/messages/[id]
 *
 * Admin only. Hard-delete a message.
 */
export const DELETE = adminRoute<{ id: string }, Params>({
  scope: "admin.messages/[id].DELETE",
  revalidate: MESSAGE_TAGS,
  handler: async ({ params }) => {
    await deleteMessage(params.id);
    return { data: { id: params.id } };
  },
});
