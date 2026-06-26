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

function stubDone() {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(
    sseStream([
      "event: progress\ndata: {\"phase\":\"cloning\"}\n\n",
      "event: done\ndata: {\"id\":\"abcdefghijklmnop\"}\n\n"
    ]),
    { headers: { "content-type": "text/event-stream" } }
  )));
}

beforeEach(() => { push.mockReset(); });

describe("CreateForm", () => {
  it("submits the single URL field as { input } and navigates on done", async () => {
    stubDone();
    render(<CreateForm />);
    await userEvent.type(screen.getByLabelText(/file url/i), "https://github.com/a/b/blob/main/src/x.ts");
    await userEvent.click(screen.getByRole("button", { name: /animate/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/a/abcdefghijklmnop"));
    const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body).toEqual({ input: "https://github.com/a/b/blob/main/src/x.ts" });
  });

  it("manual mode submits { repoInput, filePath } and navigates on done", async () => {
    stubDone();
    render(<CreateForm />);
    await userEvent.click(screen.getByRole("button", { name: /manual/i }));
    await userEvent.type(screen.getByLabelText(/repository/i), "https://github.com/a/b");
    await userEvent.type(screen.getByLabelText(/file path/i), "src/x.ts");
    await userEvent.click(screen.getByRole("button", { name: /animate/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/a/abcdefghijklmnop"));
    const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body).toEqual({ repoInput: "https://github.com/a/b", filePath: "src/x.ts" });
  });

  it("shows an error and re-enables submit when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    render(<CreateForm />);
    await userEvent.type(screen.getByLabelText(/file url/i), "https://github.com/a/b/blob/main/x.ts");
    const button = screen.getByRole("button", { name: /animate/i });
    await userEvent.click(button);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });
});
