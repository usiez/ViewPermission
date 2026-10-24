
(() => {
    const { metro, patcher, utils } = vendetta;
    const { findByProps, findByStoreName } = metro;
    const { before, after } = patcher;
    const { React, ReactNative } = metro.common;
    const { findInReactTree } = utils;

    const LazyActionSheet = findByProps("openLazy", "hideActionSheet");
    const ActionSheetRow = findByProps("ActionSheetRow")?.ActionSheetRow;
    const ChannelStore = findByStoreName("ChannelStore");
    const GuildRoleStore = findByStoreName("GuildRoleStore");

    const permissionNames = [
        [1n << 0n, "Create Invite"],
        [1n << 1n, "Kick Members"],
        [1n << 2n, "Ban Members"],
        [1n << 3n, "Administrator"],
        [1n << 4n, "Manage Channels"],
        [1n << 5n, "Manage Guild"],
        [1n << 10n, "View Channels"],
        [1n << 11n, "Send Messages"],
        [1n << 13n, "Manage Messages"],
        [1n << 20n, "Use Application Commands"],
        [1n << 28n, "Manage Roles"],
        [1n << 29n, "Manage Webhooks"],
        [1n << 30n, "Manage Expressions"],
        [1n << 31n, "Use External Emojis"],
        [1n << 32n, "View Audit Log"],
        [1n << 33n, "Use External Stickers"],
        [1n << 34n, "Send Messages in Threads"],
        [1n << 35n, "Create Public Threads"],
        [1n << 36n, "Create Private Threads"],
        [1n << 37n, "Use External Sounds"],
        [1n << 38n, "Send Voice Messages"],
        [1n << 39n, "Set Voice Channel Status"],
        [1n << 40n, "Send Polls"],
        [1n << 41n, "Use External Apps"],
        [1n << 42n, "Pin Messages"],
        [1n << 43n, "Bypass Slowmode"]
    ];

    function showPermissions(message) {
        try {
            const channel = ChannelStore?.getChannel(message.channel_id);
            const guildId = channel?.guild_id;

            if (!guildId) {
                ReactNative.Alert.alert(
                    "View Permissions",
                    "This message is not in a server channel."
                );
                return;
            }

            const roles = GuildRoleStore?.getSortedRoles?.(guildId);

            if (!roles || !roles.length) {
                ReactNative.Alert.alert(
                    "View Permissions",
                    "Could not retrieve server roles."
                );
                return;
            }

            const lines = [];

            for (const role of roles) {
                let permissions;

                try {
                    permissions = BigInt(role.permissions ?? 0);
                } catch {
                    permissions = 0n;
                }

                const enabled = permissionNames
                    .filter(([bit]) => (permissions & bit) !== 0n)
                    .map(([, name]) => name);

                lines.push(
                    `${role.name}\n` +
                    (enabled.length ? enabled.join(", ") : "No listed permissions")
                );
            }

            const text = lines.join("\n\n");

            ReactNative.Alert.alert(
                "Server Role Permissions",
                text.slice(0, 3500),
                [{ text: "OK" }]
            );
        } catch (error) {
            ReactNative.Alert.alert(
                "View Permissions",
                String(error?.message ?? error)
            );
        }
    }

    let unpatch;

    return {
        onLoad() {
            if (!LazyActionSheet || !ActionSheetRow) {
                console.warn("[ViewPermission] Action sheet API not found.");
                return;
            }

            unpatch = before("openLazy", LazyActionSheet, ([component, key, props]) => {
                const message = props?.message;

                if (key !== "MessageLongPressActionSheet" || !message) return;

                component.then(instance => {
                    const removePatch = after("default", instance, (_, tree) => {
                        const rows = findInReactTree(
                            tree,
                            node => Array.isArray(node) &&
                                node.some?.(item =>
                                    item?.props?.label?.toLowerCase?.() === "reply"
                                )
                        );

                        if (!rows) return tree;

                        const button = React.createElement(ActionSheetRow, {
                            label: "View Permissions",
                            onPress: () => {
                                LazyActionSheet.hideActionSheet();
                                showPermissions(message);
                            }
                        });

                        rows.push(button);
                        return tree;
                    });
                });
            });
        },

        onUnload() {
            unpatch?.();
            unpatch = undefined;
        }
    };
})();
