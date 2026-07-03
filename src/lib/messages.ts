export type StoredMessage = {
  id: string;
  name: string;
  email: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

export type MessageStatus = "unread" | "read";

export type MessageListItem = StoredMessage & {
  status: MessageStatus;
};

export type MessageCreateInput = {
  name: string;
  email: string;
  body: string;
};

export type MessageValidationErrors = Partial<Record<"name" | "email" | "body", string>>;

export type MessageValidationResult =
  | {
      ok: true;
      value: MessageCreateInput;
    }
  | {
      ok: false;
      message: string;
      errors: MessageValidationErrors;
    };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function normalizeLineEndings(value: string) {
  return value.replace(/\r\n?/g, "\n");
}

function trimInput(value: string | undefined) {
  return value?.trim() ?? "";
}

export function validateMessageInput(input: Partial<MessageCreateInput>): MessageValidationResult {
  const name = trimInput(input.name);
  const email = trimInput(input.email).toLowerCase();
  const body = normalizeLineEndings(trimInput(input.body));
  const errors: MessageValidationErrors = {};

  if (!name) {
    errors.name = "Name is required.";
  }

  if (!email) {
    errors.email = "Email is required.";
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Email must be valid.";
  }

  if (!body) {
    errors.body = "Message is required.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      message: "Please complete the required fields.",
      errors,
    };
  }

  return {
    ok: true,
    value: {
      name,
      email,
      body,
    },
  };
}
