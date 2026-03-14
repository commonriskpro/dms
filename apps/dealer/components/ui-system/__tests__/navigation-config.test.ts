import { APP_NAV_GROUPS } from "../navigation/navigation.config";

describe("dealer navigation config", () => {
  it("has Workspaces and Daily work groups; website is under Daily work", () => {
    expect(APP_NAV_GROUPS.some((group) => group.label === "Platform")).toBe(false);

    const workspacesGroup = APP_NAV_GROUPS.find((group) => group.label === "Workspaces");
    expect(workspacesGroup).toBeDefined();
    expect(workspacesGroup?.items.some((item) => item.href === "/sales" || item.href === "/inventory" || item.href === "/dashboard")).toBe(true);

    const dailyWorkGroup = APP_NAV_GROUPS.find((group) => group.label === "Daily work");
    expect(dailyWorkGroup).toBeDefined();

    const websiteItem = dailyWorkGroup?.items.find((item) => item.href === "/websites");
    expect(websiteItem?.label).toBe("Websites");

    const operationsItem = dailyWorkGroup?.items.find((item) => item.href === "/deals/operations");
    expect(operationsItem?.label).toBe("Operations");
  });
});
