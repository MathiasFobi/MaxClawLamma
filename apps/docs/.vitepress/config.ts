import { defineConfig } from 'vitepress'

export default defineConfig({
    title: 'NextClaw',
    description: 'Effortlessly Simple Personal AI Assistant — Documentation',

    head: [
        ['link', { rel: 'icon', href: '/logo.svg' }],
        // Notify parent window (DocBrowser) of route changes via postMessage
        ['script', {}, `
            (function() {
                function notify() {
                    if (window.parent !== window) {
                        window.parent.postMessage({ type: 'docs-route-change', url: location.href }, '*');
                    }
                }
                // Notify on initial load
                notify();
                // Watch for SPA navigation (VitePress uses client-side routing)
                var lastUrl = location.href;
                new MutationObserver(function() {
                    if (location.href !== lastUrl) {
                        lastUrl = location.href;
                        notify();
                    }
                }).observe(document, { subtree: true, childList: true });
                // Also listen for popstate (back/forward within iframe)
                window.addEventListener('popstate', notify);
                // Listen for navigation requests from parent (DocBrowser back/forward)
                window.addEventListener('message', function(e) {
                    if (e.data && e.data.type === 'docs-navigate' && typeof e.data.path === 'string') {
                        var a = document.createElement('a');
                        a.href = e.data.path;
                        a.click();
                    }
                });
            })();
        `],
    ],

    themeConfig: {
        logo: '/logo.svg',

        nav: [
            { text: 'Guide', link: '/guide/getting-started' },
            { text: 'Channels', link: '/guide/channels' },
            { text: 'GitHub', link: 'https://github.com/Peiiii/nextclaw' },
        ],

        sidebar: {
            '/guide/': [
                {
                    text: 'Getting Started',
                    items: [
                        { text: 'Introduction', link: '/guide/introduction' },
                        { text: 'Quick Start', link: '/guide/getting-started' },
                        { text: 'Configuration', link: '/guide/configuration' },
                    ]
                },
                {
                    text: 'Features',
                    items: [
                        { text: 'Channels', link: '/guide/channels' },
                        { text: 'Multi-Agent Routing', link: '/guide/multi-agent' },
                        { text: 'Tools', link: '/guide/tools' },
                        { text: 'Cron & Heartbeat', link: '/guide/cron' },
                        { text: 'Session Management', link: '/guide/sessions' },
                    ]
                },
                {
                    text: 'Reference',
                    items: [
                        { text: 'Commands', link: '/guide/commands' },
                        { text: 'Troubleshooting', link: '/guide/troubleshooting' },
                    ]
                }
            ]
        },

        socialLinks: [
            { icon: 'github', link: 'https://github.com/Peiiii/nextclaw' }
        ],

        search: {
            provider: 'local'
        },

        footer: {
            message: 'Released under the MIT License.',
            copyright: 'Copyright © 2026-present NextClaw'
        },

        outline: {
            level: [2, 3],
            label: 'On this page'
        }
    }
})
