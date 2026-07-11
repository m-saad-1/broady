const fs=require('fs');
let c=fs.readFileSync('D:/WEB DEVELOPMENT/broady/apps/web/src/components/layout/site-header.tsx','utf8');

c = c.replace(
  '  { href: "/category/Juniors", label: "Juniors" },',
  '  { href: "/category/Boys", label: "Boys" },\n  { href: "/category/Girls", label: "Girls" },'
);

c = c.replace(
  'const [openMenu, setOpenMenu] = useState<"men" | "women" | "juniors" | null>(null);',
  'const [openMenu, setOpenMenu] = useState<"men" | "women" | "boys" | "girls" | null>(null);'
);

const boysMenu =             if (item.label === "Boys") {
              return (
                <div
                  key={item.href}
                  onMouseEnter={() => {
                    clearDropdownCloseTimer();
                    setOpenMenu("boys");
                  }}
                  onMouseLeave={scheduleDropdownClose}
                  className="relative"
                >
                  <Link
                    href={item.href}
                    onClick={closeDropdownMenu}
                    className={\\ inline-flex items-center py-1\}
                  >
                    {item.label}
                  </Link>
                  {openMenu === "boys" ? (
                    <div
                      onMouseEnter={clearDropdownCloseTimer}
                      onMouseLeave={scheduleDropdownClose}
                      className={dropdownMenuShellClass}
                    >
                      <div className="mx-auto grid max-w-7xl grid-cols-4 gap-4 px-4 py-6 lg:px-10">
                        {MEN_PRESET_CATEGORIES.map((cat) => {
                          const menuItem = MEN_WOMEN_MENU_ITEMS.find((menu) => menu.label === cat);
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => navigateToCatalog({ topCategory: "Junior Boys", ...menuItem?.filters })}
                              className="group block w-full text-left"
                            >
                              <div className="relative aspect-[4/3] w-full overflow-hidden border border-zinc-200 bg-zinc-100">
                                <Image
                                  src={MEN_CATEGORY_CARD_IMAGES[cat] || FALLBACK_CATEGORY_IMAGE}
                                  alt={cat}
                                  fill
                                  className="object-cover"
                                  sizes="(max-width: 768px) 50vw, 20vw"
                                />
                              </div>
                              <div className={dropdownCardLabelClass}>{cat}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            }
            if (item.label === "Girls") {
              return (
                <div
                  key={item.href}
                  onMouseEnter={() => {
                    clearDropdownCloseTimer();
                    setOpenMenu("girls");
                  }}
                  onMouseLeave={scheduleDropdownClose}
                  className="relative"
                >
                  <Link
                    href={item.href}
                    onClick={closeDropdownMenu}
                    className={\\ inline-flex items-center py-1\}
                  >
                    {item.label}
                  </Link>
                  {openMenu === "girls" ? (
                    <div
                      onMouseEnter={clearDropdownCloseTimer}
                      onMouseLeave={scheduleDropdownClose}
                      className={dropdownMenuShellClass}
                    >
                      <div className="mx-auto grid max-w-7xl grid-cols-4 gap-4 px-4 py-6 lg:px-10">
                        {WOMEN_PRESET_CATEGORIES.map((cat) => {
                          const menuItem = MEN_WOMEN_MENU_ITEMS.find((menu) => menu.label === cat);
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => navigateToCatalog({ topCategory: "Junior Girls", ...menuItem?.filters })}
                              className="group block w-full text-left"
                            >
                              <div className="relative aspect-[4/3] w-full overflow-hidden border border-zinc-200 bg-zinc-100">
                                <Image
                                  src={WOMEN_CATEGORY_CARD_IMAGES[cat] || FALLBACK_CATEGORY_IMAGE}
                                  alt={cat}
                                  fill
                                  className="object-cover"
                                  sizes="(max-width: 768px) 50vw, 20vw"
                                />
                              </div>
                              <div className={dropdownCardLabelClass}>{cat}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            };

c = c.replace(/if\s*\(item\.label\s*===\s*"Juniors"\)\s*\{[\s\S]*?return\s*\(\s*<Link\s*key=\{item\.href\}\s*href=\{item\.href\}/, boysMenu + '\n\n            return (\n              <Link key={item.href} href={item.href}');

fs.writeFileSync('D:/WEB DEVELOPMENT/broady/apps/web/src/components/layout/site-header.tsx',c);
