# Instructions
from the project root run:
- `docker compose -f ./examples/author-book/docker-compose.yml -p author-book up -d`
- `pnpm run build && cd examples/author-book/ && pnpm install && pnpm run run; cd ../..`

### Example output:
```json
[
  {
    "id": "0a16f643-fbd9-4317-a9a2-598d543decc9",
    "entityName": "Author",
    "entityId": {
      "id": "e947bbb5-0705-4ab1-83df-d9d80dab9b63"
    },
    "changeType": "create",
    "changes": {
      "data": {
        "id": {
          "next": {
            "value": "e947bbb5-0705-4ab1-83df-d9d80dab9b63",
            "marker": "value"
          },
          "prev": {
            "marker": "value"
          }
        },
        "name": {
          "next": {
            "value": "author A",
            "marker": "value"
          },
          "prev": {
            "marker": "value"
          }
        },
        "secret": {
          "next": {
            "marker": "redacted"
          },
          "prev": {
            "marker": "redacted"
          }
        }
      }
    },
    "timestamp": "2024-07-03T05:52:58.745Z"
  },
  {
    "id": "5e55f2a9-443b-4104-a1b8-38ca7edccc2b",
    "entityName": "Book",
    "entityId": {
      "id": "52f15a1c-2ed3-424d-b97b-959af8700b8b"
    },
    "changeType": "create",
    "changes": {
      "data": {
        "id": {
          "next": {
            "value": "52f15a1c-2ed3-424d-b97b-959af8700b8b",
            "marker": "value"
          },
          "prev": {
            "marker": "value"
          }
        },
        "name": {
          "next": {
            "value": "book A",
            "marker": "value"
          },
          "prev": {
            "marker": "value"
          }
        },
        "author": {
          "next": {
            "value": "e947bbb5-0705-4ab1-83df-d9d80dab9b63",
            "marker": "value"
          },
          "prev": {
            "marker": "value"
          }
        }
      }
    },
    "timestamp": "2024-07-03T05:52:58.764Z"
  },
  {
    "id": "7fd56a96-283f-47d3-84d7-c96d42f74507",
    "entityName": "Book",
    "entityId": {
      "id": "52f15a1c-2ed3-424d-b97b-959af8700b8b"
    },
    "changeType": "update",
    "changes": {
      "data": {
        "name": {
          "next": {
            "value": "book A.rev2",
            "marker": "value"
          },
          "prev": {
            "value": "book A",
            "marker": "value"
          }
        }
      }
    },
    "timestamp": "2024-07-03T05:52:58.775Z"
  }
]
```
```
create
Author { id: 'e947bbb5-0705-4ab1-83df-d9d80dab9b63' } prev: { id: undefined, name: undefined, secret: undefined }
Author { id: 'e947bbb5-0705-4ab1-83df-d9d80dab9b63' } next: {
    id: 'e947bbb5-0705-4ab1-83df-d9d80dab9b63',
    name: 'author A',
    secret: undefined
}

create
Book { id: '52f15a1c-2ed3-424d-b97b-959af8700b8b' } prev: { id: undefined, name: undefined, author: undefined }
Book { id: '52f15a1c-2ed3-424d-b97b-959af8700b8b' } next: {
    id: '52f15a1c-2ed3-424d-b97b-959af8700b8b',
    name: 'book A',
    author: 'e947bbb5-0705-4ab1-83df-d9d80dab9b63'
}

update
Book { id: '52f15a1c-2ed3-424d-b97b-959af8700b8b' } prev: { name: 'book A' }
Book { id: '52f15a1c-2ed3-424d-b97b-959af8700b8b' } next: { name: 'book A.rev2' }
```
