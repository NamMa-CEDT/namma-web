import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import type { River } from "../api/types";
import { resetState } from "../api/mock/store";
import { RiverSearch } from "./RiverSearch";

function Harness({ onPick }: { onPick: (r: River) => void }) {
  const [text, setText] = useState("");
  return <RiverSearch value={text} onChange={setText} onPick={onPick} showLabel />;
}

function renderSearch(onPick = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Harness onPick={onPick} />
    </QueryClientProvider>,
  );
  return { onPick, box: screen.getByRole("combobox") };
}

beforeEach(() => {
  localStorage.clear();
  resetState();
});

describe("RiverSearch", () => {
  it("suggests rivers as you type, with their provinces and station count", async () => {
    const { box } = renderSearch();
    fireEvent.change(box, { target: { value: "ยม" } });
    const options = await screen.findAllByRole("option");
    expect(options[0].textContent).toContain("แม่น้ำยม");
    expect(options[0].textContent).toContain("สถานี");
    expect(box.getAttribute("aria-expanded")).toBe("true");
  });

  it("finds a river by a place it runs through", async () => {
    const { box } = renderSearch();
    fireEvent.change(box, { target: { value: "อุบลราชธานี" } });
    expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining("แม่น้ำชี")]),
    );
  });

  it("moves with the arrow keys, picks with Enter, and then closes", async () => {
    const { box, onPick } = renderSearch();
    fireEvent.change(box, { target: { value: "ยม" } });
    await screen.findAllByRole("option");
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(box.getAttribute("aria-activedescendant")).toMatch(/-1$/);
    fireEvent.keyDown(box, { key: "ArrowUp" });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0][0].key).toBe("แม่น้ำยม");
    await waitFor(() => expect(box.getAttribute("aria-expanded")).toBe("false"));
  });

  it("closes on Escape and keeps the typed text", async () => {
    const { box, onPick } = renderSearch();
    fireEvent.change(box, { target: { value: "ยม" } });
    await screen.findAllByRole("option");
    fireEvent.keyDown(box, { key: "Escape" });
    expect(box.getAttribute("aria-expanded")).toBe("false");
    expect((box as HTMLInputElement).value).toBe("ยม");
    expect(onPick).not.toHaveBeenCalled();
  });

  it("shows no list for an empty box", () => {
    const { box } = renderSearch();
    fireEvent.change(box, { target: { value: "   " } });
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
