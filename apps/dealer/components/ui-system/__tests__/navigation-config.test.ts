import { APP_NAV_GROUPS } from "../navigation/navigation.config";

describe("dealer navigation config", () => {
  it("groups website navigation under Websites instead of Platform", () => {
    expect(APP_NAV_GROUPS.some((group) => group.label === "Platform")).toBe(false);

    const websitesGroup = APP_NAV_GROUPS.find((group) => group.label === "Websites");
    expect(websitesGroup).toBeDefined();

    const websiteItem = websitesGroup?.items.find((item) => item.href === "/websites");
    expect(websiteItem?.label).toBe("Website");
  });
});
