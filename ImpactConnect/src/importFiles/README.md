# Event Registration Metadata Import Files

This directory contains the metadata import files for the Event Registration program, split by metadata type for easier management and troubleshooting.

## Import Order

Import the files in the following order (numbered prefixes indicate the correct sequence):

1. **01-trackedEntityTypes.json** - Creates the Event and Participant tracked entity types
2. **02-trackedEntityAttributes.json** - Creates tracked entity attributes used by the program
3. **03-dataElements.json** - Creates all data elements used in program stages
4. **04-programStages.json** - Creates program stages with references to data elements
5. **05-programs.json** - Creates the Event Registration program with references to tracked entity types, attributes, and stages
6. **06-relationshipTypes.json** - Creates the relationship type linking participants to events

## Additional Metadata

The `additionalMetadata.json` file contains:
- Organization Unit Groups (Schools, Training/Meeting/Workshop Venues)
- User Groups (MEL Team, Facilitators, ImpactConnectAdmins)
- Additional Tracked Entity Attributes (Phone, Gender, Position, ID Number)
- Option Sets (Gender)

**Note:** Import `additionalMetadata.json` before or alongside the numbered files, as some metadata may be referenced by the program.

## Import Instructions

### Using DHIS2 Metadata Import App:

1. Log into DHIS2 as an administrator
2. Navigate to **Apps** → **Metadata Import**
3. Import files in the numbered order:
   - Upload `01-trackedEntityTypes.json` → Click **Import**
   - Upload `02-trackedEntityAttributes.json` → Click **Import**
   - Upload `03-dataElements.json` → Click **Import**
   - Upload `04-programStages.json` → Click **Import**
   - Upload `05-programs.json` → Click **Import**
   - Upload `06-relationshipTypes.json` → Click **Import`
4. Import `additionalMetadata.json` at any time (can be done before or after the numbered files)

### Using DHIS2 API:

```bash
# Set your DHIS2 instance URL and credentials
DHIS2_URL="https://your-instance.com"
USERNAME="admin"
PASSWORD="password"

# Import in order
curl -X POST "$DHIS2_URL/api/metadata" \
  -H "Content-Type: application/json" \
  -u "$USERNAME:$PASSWORD" \
  -d @01-trackedEntityTypes.json

curl -X POST "$DHIS2_URL/api/metadata" \
  -H "Content-Type: application/json" \
  -u "$USERNAME:$PASSWORD" \
  -d @02-trackedEntityAttributes.json

curl -X POST "$DHIS2_URL/api/metadata" \
  -H "Content-Type: application/json" \
  -u "$USERNAME:$PASSWORD" \
  -d @03-dataElements.json

curl -X POST "$DHIS2_URL/api/metadata" \
  -H "Content-Type: application/json" \
  -u "$USERNAME:$PASSWORD" \
  -d @04-programStages.json

curl -X POST "$DHIS2_URL/api/metadata" \
  -H "Content-Type: application/json" \
  -u "$USERNAME:$PASSWORD" \
  -d @05-programs.json

curl -X POST "$DHIS2_URL/api/metadata" \
  -H "Content-Type: application/json" \
  -u "$USERNAME:$PASSWORD" \
  -d @06-relationshipTypes.json
```

## File Contents Summary

- **01-trackedEntityTypes.json**: 2 tracked entity types (Event, Participant)
- **02-trackedEntityAttributes.json**: 7 tracked entity attributes
- **03-dataElements.json**: 54 data elements (18 per stage × 3 stages)
- **04-programStages.json**: 3 program stages (Training, Workshop, Meeting)
- **05-programs.json**: 1 program (Event Registration)
- **06-relationshipTypes.json**: 1 relationship type (Event Participant)

## Troubleshooting

If you encounter import errors:

1. **Dependency errors**: Ensure files are imported in the correct order
2. **ID conflicts**: Check if metadata with the same IDs already exists
3. **Missing references**: Verify all referenced IDs exist before importing dependent files
4. **Access errors**: Ensure you have sufficient permissions to create metadata

## Notes

- All IDs match the constants defined in `src/consts.js`
- The metadata uses "_for_demo" suffix in names for demo/testing purposes
- You may need to adjust organization unit groups and user groups based on your DHIS2 instance setup
