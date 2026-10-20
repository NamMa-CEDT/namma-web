import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { keys } from "../../api/queries";
import type { Profile } from "../../api/types";
import { copy } from "../../copy";
import { ProfilePanel } from "./ProfilePanel";

const SID = "s-test";

// A shop with its own dog (SavedPlace.facts) and a car said without a place (general).
const PROFILE: Profile = {
  places: [
    {
      id: 7,
      label: "ร้านส้มตำ",
      lat: 19.91,
      lon: 99.84,
      approx: true,
      where: "อ.เมืองเชียงราย จ.เชียงราย",
      facts: [{ kind: "household", text: "สัตว์เลี้ยง: หมา", sensitive: false, list: "pets", names: ["หมา"] }],
      nearest: null,
    },
  ],
  facts: [{ kind: "assets", text: "มีรถยนต์", sensitive: false, list: null, names: [] }],
  consent: { granted: true, ts: "2026-10-20T06:00:00+07:00" },
  pending_consent: false,
  line_linked: false,
};

function renderPanel(profile: Profile) {
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(keys.profile(SID), profile);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ProfilePanel chatSession={SID} onAsk={() => {}} drawerOpen={false} onCloseDrawer={() => {}} forget={{ asking: false, setAsking: () => {} }} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  // The desktop column (the drawer holds the same rows).
  return within(screen.getAllByRole("complementary")[0]);
}

describe("ProfilePanel place facts", () => {
  it("shows a place's own facts in its card, renamable and deletable there", () => {
    const col = renderPanel(PROFILE);
    fireEvent.click(col.getByRole("button", { name: /ที่ตั้ง/ })); // all set up but LINE: that row opens first
    expect(col.getByRole("button", { name: copy.profile.renameLabel("สัตว์เลี้ยง: หมา") })).toBeTruthy();
    expect(col.getByRole("button", { name: copy.profile.deleteLabel(copy.profile.placeFacts("ร้านส้มตำ")) })).toBeTruthy();
  });

  it("says the general facts hold everywhere when a place has its own", () => {
    const col = renderPanel(PROFILE);
    fireEvent.click(col.getByRole("button", { name: new RegExp(copy.profile.house) }));
    expect(col.getAllByText("มีรถยนต์").length).toBe(2); // the row's summary and its chip
    expect(col.getByText(copy.profile.everywhere)).toBeTruthy();
  });

  it("works with a backend that sends no place facts", () => {
    const col = renderPanel({ ...PROFILE, places: [{ ...PROFILE.places[0], facts: undefined }] });
    fireEvent.click(col.getByRole("button", { name: new RegExp(copy.profile.house) }));
    expect(col.queryByText(copy.profile.everywhere)).toBeNull();
  });
});
