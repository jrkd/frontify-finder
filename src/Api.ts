import { FinderError } from './Exception';
import { logMessage } from './Logger';
import { httpCall } from './Utils';

type Options = {
    domain: string;
    bearerToken: string;
};

type AssetsResponse = {
    errors?: AssetsResponseError[];
    data?: {
        assets: FrontifyAsset[];
    };
    extensions: {
        beta?: AssetsResponseBetaExtension[];
        complexityScore: number;
    };
};

type AssetsResponseError = {
    extensions: {
        category: string;
    };
    locations: AssetsResponseErrorLocation[];
    message: string;
};

type AssetsResponseErrorLocation = {
    column: number;
    line: number;
};

type AssetsResponseBetaExtension = {
    message: string;
};

export type Asset = {
    id: number | string;
};

export type FrontifyAsset = {
    id: string;
    title: string;
    description: string;
    creator: {
        name: string;
    };
    createdAt: string;
    type: string;
    licenses?: {
        title: string;
        text: string;
    };
    copyright?: {
        status: string;
        notice: string;
    };
    tags?: {
        value: string;
        source: string;
    };
    metadataValues?: {
        value: string | number;
        metadataField: {
            id: string;
            label: string;
        };
    };
    filename: string;
    size: number;
    downloadUrl?: string;
    previewUrl?: string;
    icon?: string;
    focalPoint?: number[];
    width?: number;
    height?: number;
    duration?: number;
    bitrate?: number;
};

const ASSET_BY_IDS_QUERY = `
query AssetByIds($ids: [ID!]!) {
  assets(ids: $ids) {
    id
    title
    description
    type: __typename
    creator {
      name
    }
    createdAt
    ...withMetadata
    ...onImage
    ...onDocument
    ...onFile
    ...onAudio
    ...onVideo
  }
}

fragment withMetadata on Asset {
  tags {
    value
    source
  }
  metadataValues {
    value
    metadataField {
      id
      label
    }
  }
  copyright {
    status
    notice
  }
  licenses {
    title
    text: license
  }
}

fragment onImage on Image {
  filename
  size
  downloadUrl(validityInDays: 1)
  previewUrl
  width
  height
  focalPoint
}

fragment onFile on File {
  filename
  size
  downloadUrl(validityInDays: 1)
  icon: previewUrl
}

fragment onDocument on Document {
  filename
  size
  downloadUrl(validityInDays: 1)
  previewUrl
  focalPoint
}

fragment onAudio on Audio {
  filename
  size
  downloadUrl(validityInDays: 1)
  previewUrl
}

fragment onVideo on Video {
  filename
  size
  downloadUrl(validityInDays: 1)
  previewUrl
  width
  height
  duration
  bitrate
}
`;

export async function requestAssetsById({ domain, bearerToken }: Options, ids: Asset[]): Promise<FrontifyAsset[]> {
    const response = await httpCall(`https://${domain}/graphql`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${bearerToken}`,
            'x-frontify-beta': 'enabled',
        },
        body: JSON.stringify({
            query: ASSET_BY_IDS_QUERY,
            variables: {
                ids,
            },
        }),
    }).then((response) => {
        return response as AssetsResponse;
    });

    if (response.errors) {
        logMessage('error', {
            code: 'ERR_FINDER_ASSETS_ERRORS',
            message: 'Failed to enrich assets.',
            error: response.errors[0],
        });
    }

    if (!response?.data?.assets || response.data.assets.length === 0) {
        throw new FinderError('ERR_FINDER_ASSETS_DATA', 'No assets returned by request.');
    }

    return response.data.assets.map((asset: FrontifyAsset) => {
        if (asset.previewUrl && asset.previewUrl.includes('width={width}')) {
            asset.previewUrl = asset.previewUrl.split('?')[0];
        }

        return asset;
    });
}
