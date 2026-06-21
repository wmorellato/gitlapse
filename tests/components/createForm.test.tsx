import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { CreateForm } from "@/components/CreateForm";

function sseStream(events: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) { for (const e of events) c.enqueue(enc.encode(e)); c.close(); }
  });
}

beforeEach(() => { push.mockReset(); });

describe("CreateForm", () => {
  it("navigates to the animation on done", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      sseStream([
        "event: progress\ndata: {\"phase\":\"cloning\"}\n\n",
        "event: done\ndata: {\"id\":\"abcdefghijklmnop\"}\n\n"
      ]),
      { headers: { "content-type": "text/event-stream" } }
    )));

    render(<CreateForm />);
    await userEvent.type(screen.getByLabelText(/repository/i), "https://github.com/a/b");
    await userEvent.type(screen.getByLabelText(/file path/i), "src/x.ts");
    await userEvent.click(screen.getByRole("button", { name: /animate/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/a/abcdefghijklmnop"));
  });

  it("shows an error and re-enables submit when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    render(<CreateForm />);
    await userEvent.type(screen.getByLabelText(/repository/i), "https://github.com/a/b");
    await userEvent.type(screen.getByLabelText(/file path/i), "src/x.ts");
    const button = screen.getByRole("button", { name: /animate/i });
    await userEvent.click(button);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });
});
