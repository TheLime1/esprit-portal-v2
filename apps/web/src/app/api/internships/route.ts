import { NextResponse } from "next/server";

interface InternshipItem {
    id: string;
    title: string;
    company: string;
    location: string;
    type: string;
    closingDate: string;
    link: string;
    description: string;
    imageUrl: string;
    pubDate: string;
    addedBy: string;
}

// Parse HTML entities
function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
}

// Extract text from HTML
function extractTextFromHtml(html: string): string {
    return html.replace(/<[^>]+>/g, '').trim();
}

// Parse RSS item to internship
function parseRssItem(itemXml: string): InternshipItem | null {
    try {
        // Extract title
        const titleMatch = itemXml.match(/<title>([^<]*)<\/title>/);
        const fullTitle = titleMatch ? titleMatch[1] : '';

        // Extract company from title (format: "Job Title - Company - COMPANY")
        const titleParts = fullTitle.split(' - ');
        const title = titleParts[0] || fullTitle;
        const company = titleParts.length > 1 ? titleParts[titleParts.length - 1] : '';

        // Extract link
        const linkMatch = itemXml.match(/<link>([^<]*)<\/link>/);
        const link = linkMatch ? linkMatch[1] : '';

        // Extract ID from link
        const idMatch = link.match(/\/jobs\/(\d+)/);
        const id = idMatch ? idMatch[1] : '';

        // Extract pubDate
        const pubDateMatch = itemXml.match(/<pubDate>([^<]*)<\/pubDate>/);
        const pubDate = pubDateMatch ? pubDateMatch[1] : '';

        // Extract description
        const descMatch = itemXml.match(/<description>([\s\S]*?)<\/description>/);
        const descHtml = descMatch ? decodeHtmlEntities(descMatch[1]) : '';

        // Extract image URL from description
        const imgMatch = descHtml.match(/src="([^"]+)"/);
        const imageUrl = imgMatch ? imgMatch[1] : '';

        // Extract location/type
        const locationMatch = descHtml.match(/<p>Location:\s*([^<]+)<\/p>/);
        const locationType = locationMatch ? extractTextFromHtml(locationMatch[1]).trim() : '';

        // Extract closing date
        const closingMatch = descHtml.match(/<strong>(\d{2}\/\d{2}\/\d{4})<\/strong>/);
        const closingDate = closingMatch ? closingMatch[1] : '';

        // Extract added by
        const addedByMatch = descHtml.match(/Added by:\s*<strong>([^<]+)<\/strong>/);
        const addedBy = addedByMatch ? addedByMatch[1].trim() : '';

        // Extract description text - get content after "Description:" paragraph
        const descTextMatch = descHtml.match(/<p>Description:<\/p>\s*<p>([^<]+)<\/p>/);
        const description = descTextMatch ? descTextMatch[1].trim() : '';

        return {
            id,
            title: title.trim(),
            company: company.trim(),
            location: locationType,
            type: locationType.toLowerCase().includes('internship') ? 'Internship' :
                locationType.toLowerCase().includes('contract') ? 'Contract' :
                    locationType.toLowerCase().includes('permanent') ? 'Permanent' : 'Job',
            closingDate,
            link,
            description: description.slice(0, 300) + (description.length > 300 ? '...' : ''),
            imageUrl,
            pubDate,
            addedBy,
        };
    } catch {
        return null;
    }
}

export async function GET() {
    try {
        const response = await fetch('https://thelime1.github.io/esprit-jobs/data/feed.xml', {
            next: { revalidate: 3600 } // Cache for 1 hour
        });

        if (!response.ok) {
            throw new Error('Failed to fetch RSS feed');
        }

        const xmlText = await response.text();

        // Extract all items
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        const items: InternshipItem[] = [];
        let match;

        while ((match = itemRegex.exec(xmlText)) !== null) {
            const parsed = parseRssItem(match[1]);
            if (parsed) {
                items.push(parsed);
            }
        }

        return NextResponse.json({
            success: true,
            items,
            total: items.length,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching internships:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Failed to fetch internships' },
            { status: 500 }
        );
    }
}
