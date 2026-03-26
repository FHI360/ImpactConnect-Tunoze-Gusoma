import { useAlert, useDataEngine, useDataQuery } from '@dhis2/app-runtime';
import i18n from '@dhis2/d2-i18n';
import { Modal, ModalActions, ModalContent, ModalTitle, Pagination, SingleSelectField, Transfer } from '@dhis2/ui';
import { SingleSelectOption } from '@dhis2-ui/select';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
    ACTIVITY_STAGE_MAPPING,
    APP_GROUP,
    config,
    EVENT_OPTIONS,
    FACILITATOR_GROUP,
    MEL_TEAM_GROUP
} from '../consts.js';
import {
    daysBetween,
    fetchEntities,
    filterDataValues,
    getParticipant,
    isObjectEmpty,
    paginate,
    prepareAndDownloadAttendance,
    searchEntities,
    SharedStateContext,
    sortEntities,
    trackerCreate,
    trackerDelete
} from '../utils.js';
import { DataElementsComponent } from './DataElementsComponent.js';
import { Navigation } from './Navigation.js';
import NotFoundPage from './NotFoundPage.js';
import OrganisationUnitComponent from './OrganisationUnitComponent.js';
import { SearchComponent } from './SearchComponent.js';
import { SpinnerComponent } from './SpinnerComponent.js';
import { VenueComponent } from './VenueComponent.js';

export const EventsComponent = () => {
    const engine = useDataEngine();
    const sharedState = useContext(SharedStateContext)

    const {
        selectedSharedIsMEL,
        selectedSharedIsAdmin,
        setSelectedIsAdmin,
        setSelectedIsMEL,
        setSelectedIsFacilitator,
    } = sharedState;

    const [selectedVenue, setSelectedVenue] = useState('');
    const [trainings, setTrainings] = useState([]);
    const [allTrainings, setAllTrainings] = useState([]);
    const [selectedTraining, setSelectedTraining] = useState('');
    const [entityType, setEntityType] = useState('');
    const [orgUnit, setOrgUnit] = useState('');
    const [selectedOu, setSelectedOu] = useState();
    const [participants, setParticipants] = useState([]);
    const [entities, setEntities] = useState([]);
    const [selectedEntities, setSelectedEntities] = useState([]);
    const [allEntities, setAllEntities] = useState([]);
    const [trainingAttributes, setTrainingAttributes] = useState([]);
    const [trainingAttributesData, setTrainingAttributesData] = useState([]);
    const [participantsProgram, setParticipantsProgram] = useState('');
    const [trainingProgram, setTrainingProgram] = useState('');
    const [nameAttributes, setNameAttributes] = useState([]);
    const [eventNameAttribute, setEventNameAttribute] = useState('');
    const [page, setPage] = useState(1);
    const [totalEntities, setTotalEntities] = useState(0);
    const [pageSize, setPageSize] = useState(50);
    const [participantPageSize, setParticipantPageSize] = useState(50);
    const [participantsPage, setParticipantsPage] = useState(0);
    const [pagedParticipants, setPagedParticipants] = useState([]);
    const [groupValues, setGroupValues] = useState({});
    const [orgUnits, setOrgUnits] = useState([]);
    const [events, setEvents] = useState([]);
    const [event, setEvent] = useState({});
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [scrollHeight, setScrollHeight] = useState('350px');
    const [loadingEntities, setLoadingEntities] = useState(false);
    const [disable, setDisable] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [toggle, setToggle] = useState(false);
    const [configuredCondition, setSelectedConfiguredCondition] = useState([]);
    const [confirmShow, setConfirmShow] = useState(false);
    const [invalid, setInvalid] = useState(false);
    const [users, setUsers] = useState([]);
    const [facilitators, setFacilitators] = useState([]);
    const [root, setRoot] = useState('');
    const [retries, setRetries] = useState(0);
    const [stageDataElements, setStageDataElements] = useState([]);
    const [success, setSuccess] = useState(false);

    const memoizedData = useMemo(() => {
        return {
            trainingAttributes, groupValues, trainingAttributesData, eventNameAttribute
        };
    }, [trainingAttributes, groupValues, trainingAttributesData, eventNameAttribute]);

    const {show} = useAlert(
        ({msg}) => msg,
        ({type}) => ({[type]: true})
    )

    const dataStoreQuery = {
        dataStore: {
            resource: `dataStore/${config.dataStoreName}?fields=.`,
        }
    };

    const userQuery = {
        user: {
            resource: 'me',
            params: {
                fields: 'username, organisationUnits(id, root), userGroups(id, displayName, name)'
            }
        }
    }

    const organisationsQuery = {
        orgUnits: {
            resource: `organisationUnits`,
            params: {
                fields: ['id', 'displayName'],
                paging: 'false',
            }
        }
    }

    const entitiesQuery = {
        entities: {
            resource: 'tracker/trackedEntities',
            params: ({orgUnit, program, page, pageSize}) => {
                return ({
                    program: program,
                    orgUnit: orgUnit,
                    pageSize: pageSize,
                    page: page,
                    paging: true,
                    totalPages: true,
                    fields: 'trackedEntity,attributes,orgUnit',
                })
            }
        }
    }

    const usersQuery = {
        users: {
            resource: 'userGroups',
            params: {
                paging: false,
                fields: 'name,users(name,username)',
                order: 'displayName'
            }
        }
    }

    const dataElementsQuery = {
        dataElements: {
            resource: 'programStages',
            params: {
                paging: false,
                fields: 'id,programStageDataElements(dataElement(id))'
            }
        }
    }

    const {data: dataElements} = useDataQuery(dataElementsQuery);

    const {data: usersData} = useDataQuery(usersQuery);

    const {data: entityData, refetch} = useDataQuery(entitiesQuery, {
        variables: {
            program: participantsProgram,
            orgUnit: orgUnit,
            page,
            pageSize
        }
    });

    const {data: userData} = useDataQuery(userQuery);

    const {data: orgUnitsData} = useDataQuery(organisationsQuery);

    const {data: programData} = useDataQuery({
        programs: {
            resource: `programs`,
            params: {
                fields: 'id, trackedEntityType(id)',
                paging: false
            }
        }
    });

    const {data: dataStore} = useDataQuery(dataStoreQuery);

    useEffect(() => {
        if (userData?.user) {
            setRoot(userData.user.organisationUnits[0].id);
            const userGroupsMemberships = userData.user.userGroups
            if (userGroupsMemberships.length > 0) {
                const isAdmin = userGroupsMemberships.some(member => APP_GROUP === member.name);
                setSelectedIsAdmin(isAdmin);
                const isFacilitator = userGroupsMemberships.some(member => FACILITATOR_GROUP === member.name);
                setSelectedIsFacilitator(isFacilitator);
                const isMEL = userGroupsMemberships.some(member => MEL_TEAM_GROUP === member.name);
                setSelectedIsMEL(isMEL);
            }
        }
    }, [userData])

    useEffect(() => {
        if (dataElements) {
            const data = dataElements.dataElements.programStages.map(ps => {
                return {
                    stage: ps.id,
                    dataElements: ps.programStageDataElements.flatMap(psde => psde.dataElement.id)
                }
            })

            setStageDataElements(data)
        }
    }, [dataElements]);

    useEffect(() => {
        if (usersData && usersData.users) {
            const users = usersData.users.userGroups.filter(g => g.name === FACILITATOR_GROUP).flatMap(group => {
                return group.users.map(user => {
                    return {
                        value: user.username,
                        label: user.displayName
                    }
                })
            }).sort((u1, u2) => u1.label.localeCompare(u2.label));

            setUsers(users);
        }

    }, [usersData])

    useEffect(() => {
        if (trainingProgram && root) {

            engine.query({
                trainings: {
                    resource: 'tracker/trackedEntities',
                    params: {
                        program: trainingProgram,
                        ouMode: 'DESCENDANTS',
                        paging: false,
                        fields: '*',
                        orgUnit: root
                    }
                }
            }).then(res => {
                if (res && res.trainings) {
                    setAllTrainings(res.trainings.trackedEntities);
                }
            })
        }

    }, [trainingProgram, root])

    useEffect(() => {
        if (retries > 0) {
            saveTraining();
        } else if (saving && !success) {
            show({msg: i18n.t('There was an error updating records'), type: 'error'});
        }
        setSaving(false);
    }, [retries]);

    useEffect(() => {
        if (dataStore?.dataStore?.entries) {
            const entry = dataStore.dataStore.entries.find(e => e.key === `${config.dataStoreKey}`);
            if (entry) {
                setNameAttributes(entry.value.nameAttributes || []);
                setTrainingAttributes(entry.value.trainingAttributes || []);
                setTrainingProgram(entry.value.trainingProgram);
                setParticipantsProgram(entry.value.participantsProgram);
                setEventNameAttribute(entry.value.eventNameAttribute);
                setSelectedConfiguredCondition(entry.value.configuredCondition || []);
            }
        }
    }, [dataStore]);

    useEffect(() => {
        if (orgUnitsData && orgUnitsData.orgUnits) {
            setOrgUnits(orgUnitsData.orgUnits.organisationUnits);
        }
    }, [orgUnitsData]);

    useEffect(() => {
        if (programData && programData.programs) {
            setEntityType(programData.programs.programs.find(p => p.id === trainingProgram)?.trackedEntityType.id)
        }
    }, [trainingProgram]);

    useEffect(() => {
        if (entityData) {
            if (entityData.entities) {
                setAllEntities(entityData.entities.trackedEntities);
                setEntities(entityData.entities.trackedEntities);
                setTotalEntities(entityData.entities.total);
                setSelectedEntities([])
            } else {
                setEntities([]);
                setTotalEntities(0);
            }
        }

    }, [orgUnit, participantsProgram, entityData, page, pageSize]);

    useEffect(() => {
        setPage(1);
        refetch({page: 1, pageSize: pageSize, program: participantsProgram, orgUnit: orgUnit});
    }, [orgUnit, participantsProgram]);

    useEffect(() => {
        refetch({page, pageSize: pageSize, program: participantsProgram, orgUnit: orgUnit});
    }, [pageSize, page])

    useEffect(() => {
        pageParticipants(1, participantPageSize);
    }, [participants]);

    useEffect(() => {
        setLoadingEntities(false);
    }, [allEntities]);

    useEffect(() => {
        engine.query({
            programs: {
                resource: `programs`,
                params: {
                    fields: ['id, programTrackedEntityAttributes(trackedEntityAttribute(id, valueType,displayName,optionSet(id)))'],
                    paging: 'false'
                },
            }
        }).then(res => {
            if (res && res.programs) {
                const program = res.programs.programs.find(p => p.id === trainingProgram);
                if (program) {
                    const attributes = program.programTrackedEntityAttributes.map(tea => {
                        return tea.trackedEntityAttribute
                    });
                    setTrainingAttributesData(attributes);
                }
            }
        })
    }, [trainingProgram]);

    useEffect(() => {
        if (trainingProgram && selectedVenue) {
            fetchEventAndTrainings()
        }

    }, [entityType, selectedVenue]);

    useEffect(() => {
        setFacilitators([]);
        const training = events.find(evt => evt.trackedEntity === selectedTraining);
        if (training) {
            setLoading(true);
            const values = {};
            training.attributes.forEach(attr => {
                values[attr.attribute] = attr.value;
            })
            setGroupValues(values);

            const facilitators = training.attributes.find(attr => attr.attribute === EVENT_OPTIONS.attributes.facilitators)?.value;
            if (facilitators && facilitators.length) {
                setFacilitators(facilitators.split(','))
            }

            setParticipants([]);

            const ids = training.relationships.map(rel => rel.from.trackedEntity.trackedEntity);
            if (ids.length > 0) {
                fetchEntities(engine, ids, 'trackedEntity,orgUnit,attributes,relationships').then(value => {
                    const attendees = sortEntities(value.map(v => v.entity), nameAttributes);
                    setParticipants(attendees);
                    setLoading(false);
                });
            } else {
                setLoading(false);
            }
        }

        if (selectedTraining) {
            fetchEntities(engine, [selectedTraining], '*').then(value => {
                const trainings = value.map(v => v.entity);
                if (trainings && trainings.length) {
                    setEvent(trainings[0]);
                }
            });
        }
    }, [selectedTraining, toggle]);

    useEffect(() => {
        const adjustScrollHeight = () => {
            const height = window.innerHeight;
            if (height < 800) {
                setScrollHeight('350px');
            } else {
                setScrollHeight('700px');
            }
        };

        // Adjust scrollHeight initially
        adjustScrollHeight();

        // Add event listener to adjust on resize
        window.addEventListener('resize', adjustScrollHeight);

        // Clean up event listener on component unmount
        return () => {
            window.removeEventListener('resize', adjustScrollHeight);
        };
    }, []);

    useEffect(() => {
        if (groupValues[EVENT_OPTIONS.attributes.startDate] && groupValues[EVENT_OPTIONS.attributes.endDate]) {
            if (new Date(groupValues[EVENT_OPTIONS.attributes.startDate]) > new Date(groupValues[EVENT_OPTIONS.attributes.endDate])) {
                show({msg: i18n.t('Start date cannot be after end date'), type: 'error'});
            }
        }
    }, [groupValues]);

    const fetchEventAndTrainings = () => {
        fetchEvents().then(eventData => {
            if (eventData && eventData.events) {
                setEvents(eventData.events.trackedEntities);

                const trainings = new Set(eventData.events.trackedEntities?.flatMap(i => {
                    return i.attributes.map(attr => {
                        attr['trackedEntity'] = i.trackedEntity;
                        return attr;
                    })
                }).filter(attr => attr.attribute === eventNameAttribute).map(attr => {
                    return {
                        id: attr.trackedEntity,
                        label: attr.value
                    }
                }));
                setTrainings(Array.from(trainings));
            }
        })
    }

    const orgUnitChanged = event => {
        setOrgUnit(event.id);
        setSelectedOu(event.selected)

        setLoadingEntities(true);
    }

    const addSelection = () => {
        const selection = selectedEntities.filter(entity =>
            !participants.some(participant => participant.trackedEntity === entity.trackedEntity)
        );
        setParticipants(prev => [...prev, ...selection]);
    }

    const groupDataElementValue = (attribute) => {
        return groupValues[attribute];
    }

    const createOrUpdateGroupEvent = useCallback((dataElement, value) => {
        setGroupValues((prevValues) => ({
            ...prevValues,
            [dataElement.id]: value,
        }));
    }, []);

    const uniqueName = () => {
        return `${groupDataElementValue(EVENT_OPTIONS.attributes.event)}_${new Date(groupDataElementValue(EVENT_OPTIONS.attributes.startDate)).toISOString().substring(0, 10)}_${new Date(groupDataElementValue(EVENT_OPTIONS.attributes.endDate)).toISOString().substring(0, 10)}`
    }

    const pageParticipants = (page = 1, size = participantPageSize) => {
        setParticipantsPage(page);
        const currentPage = paginate(participants, page, size);
        setPagedParticipants(currentPage);
    }

    const saveTraining = async () => {
        if (!validateTraining()) {
            return;
        }

        setSuccess(false);

        let type = entityType;
        if (!type || type.length === 0) {
            const programData = await engine.query({
                programs: {
                    resource: `programs`,
                    params: {
                        fields: 'id, trackedEntityType(id)',
                        paging: false
                    }
                }
            });
            type = programData.programs.programs.find(p => p.id === trainingProgram)?.trackedEntityType.id;
        }
        let attributes = trainingAttributes.map(attr => {
            const valueType = trainingAttributesData.find(ta => ta.id === attr).valueType;
            let value = groupDataElementValue(attr);

            if (value && valueType) {
                if (valueType.includes('DATE')) {
                    value = new Date(value).toISOString()
                }
            }
            if (valueType === 'TRUE_ONLY' && !value) {
                value = null;
            }

            if (attr === eventNameAttribute) {
                value = uniqueName();
            }

            return {
                valueType,
                attribute: attr,
                value
            }
        });

        attributes = attributes.filter(attr => !(attr.attribute === EVENT_OPTIONS.attributes.days || attr.attribute === EVENT_OPTIONS.attributes.facilitators))
        attributes.push({
            attribute: EVENT_OPTIONS.attributes.days,
            value: daysBetween(new Date(groupDataElementValue(EVENT_OPTIONS.attributes.startDate)), new Date(groupDataElementValue(EVENT_OPTIONS.attributes.endDate)))
        });

        attributes.push({
            attribute: EVENT_OPTIONS.attributes.facilitators,
            value: facilitators.join()
        });

        let entity = {
            orgUnit: selectedVenue,
            trackedEntityType: type,
            trackedEntity: selectedTraining,
            attributes: attributes,
            enrollments: [
                {
                    program: trainingProgram,
                    orgUnit: selectedVenue,
                    status: 'ACTIVE',
                    occurredAt: new Date().toISOString(),
                    enrolledAt: new Date().toISOString(),
                    attributes
                }
            ]
        }

        let trackedEntity = selectedTraining;

        if (event && !isObjectEmpty(event)) {
            event.enrollments[0].attributes = attributes;
            event.attributes = attributes;
            entity = event;
        }

        setSaving(true);
        const response = await trackerCreate(engine, {
            trackedEntities: [entity]
        });
        if (!response) {
            setRetries(prev => {
                if (prev === 0) {
                    return 3;
                }
                return prev - 1;
            })
        } else {
            if (response.TRACKED_ENTITY) {
                trackedEntity = response?.TRACKED_ENTITY?.objectReports[0].uid;
            }
            if (trackedEntity) {
                saveRelationships(trackedEntity).then(_ => {
                    setEntities([]);
                    setSelectedTraining('');
                    fetchEvents().then(eventData => {
                        if (eventData && eventData.events) {
                            setEvents(eventData.events.trackedEntities);
                            setToggle((prev) => !prev);
                        }
                    });

                });

                fetchEvents().then(eventData => {
                    if (eventData && eventData.events) {
                        setEvents(eventData.events.trackedEntities);
                        setSelectedTraining(trackedEntity);
                    }
                });

                fetchEventAndTrainings();

                const training = events.find(evt => evt.trackedEntity === selectedTraining);
                if (training) {
                    const ids = training.relationships.map(rel => rel.from.trackedEntity.trackedEntity);
                    if (ids.length > 0) {
                        fetchEntities(engine, ids, 'trackedEntity,orgUnit,attributes,relationships').then(value => {
                            const attendees = sortEntities(value.map(v => v.entity), nameAttributes);
                            setParticipants(attendees);

                            updateAttributes();
                        });
                    }
                }
            }
            show({msg: i18n.t('Event successfully updated'), type: 'success'});
            setSuccess(true);
            setSaving(false);
            setRetries(0);
        }
    }

    const allParticipantsInTraining = () => {
        return participants.every(participant => {
            return participant.relationships?.some(rel => {
                return rel.relationshipType === EVENT_OPTIONS.relationshipType &&
                    rel.to.trackedEntity.trackedEntity === selectedTraining
            })
        })
    }

    const deleteEvent = async () => {
        setDeleting(true);
        const result = await trackerDelete(engine, event);
        if (result) {
            show({msg: i18n.t('Event successfully deleted'), type: 'success'});
            fetchEventAndTrainings();
            setParticipants([])
            setGroupValues({})
            setEvent(null)
            setSelectedTraining('');
        } else {
            show({msg: i18n.t('Could not delete Event'), type: 'error'});
        }
        setDeleting(false);
    }

    const saveRelationships = async (trackedEntity) => {
        const needRelationship = participants.map(p => {
            const rels = p.relationships?.find(rel => rel.from.trackedEntity.trackedEntity === p.trackedEntity);
            if (!rels) {
                return p.trackedEntity;
            }
            return null;
        }).filter(tei => tei && tei.length > 0);
        const relationships = needRelationship.map(p => {
            return {
                relationshipType: EVENT_OPTIONS.relationshipType,
                from: {
                    trackedEntity: {
                        trackedEntity: p
                    }
                },
                to: {
                    trackedEntity: {
                        trackedEntity: trackedEntity
                    }
                }
            }
        });
        return trackerCreate(engine, {
            relationships
        });
    }

    const removeParticipant = async (entity) => {
        setParticipants(participants.filter(p => p.trackedEntity !== entity.trackedEntity));
        pageParticipants();

        const training = events.find(evt => evt.trackedEntity === selectedTraining);
        if (training) {
            const relationship = training.relationships.find(rel => rel?.from?.trackedEntity?.trackedEntity === entity.trackedEntity)?.relationship;
            if (relationship) {
                const response = await trackerDelete(engine, {
                    relationships: [{
                        relationship
                    }]
                });
                if (response) {
                    show({msg: i18n.t('Attendee successfully removed'), type: 'success'});
                } else {
                    show({msg: i18n.t('There was an error removing attendee'), type: 'error'});
                }
            }
        }
    }

    const fetchEvents = () => {
        return engine.query({
            events: {
                resource: `tracker/trackedEntities`,
                params: ({orgUnit}) => ({
                    program: trainingProgram,
                    fields: 'trackedEntity,attributes,relationships(relationship,from(trackedEntity(trackedEntity)))',
                    orgUnit,
                    paging: false
                })
            }
        }, {
            variables: {
                orgUnit: selectedVenue
            }
        });
    }

    const setVenue = (venue) => {
        if (venue === 'Select Venue') {
            venue = '';
        }
        setSelectedVenue(venue);
        setParticipants([])
        setGroupValues({})
        setEvent(null)
        setSelectedTraining('');
    }

    const validateTraining = () => {
        return trainingAttributesData.every(ta => {
            const valueType = ta.valueType;
            if (ta.id === EVENT_OPTIONS.attributes.uniqueName || ta.id === EVENT_OPTIONS.attributes.days) {
                return true;
            }
            if (ta.id === EVENT_OPTIONS.attributes.facilitators) {
                return facilitators.length !== 0;
            }
            if (valueType === 'TRUE_ONLY' || valueType === 'BOOLEAN') {
                return true;
            }
            if (valueType === 'INTEGER' || valueType === 'NUMBER') {
                const value = parseInt(groupValues[ta.id]);
                return value === 0 || !!value;
            }
            if (valueType === 'INTEGER_ZERO_OR_POSITIVE') {
                const value = parseInt(groupValues[ta.id]);
                return value >= 0;
            }
            if (valueType === 'INTEGER_NEGATIVE') {
                const value = parseInt(groupValues[ta.id]);
                return value < 0;
            }
            if (valueType === 'INTEGER_POSITIVE') {
                const value = parseInt(groupValues[ta.id]);
                return value > 0;
            }
            if (new Date(groupValues[EVENT_OPTIONS.attributes.startDate]) > new Date(groupValues[EVENT_OPTIONS.attributes.endDate])) {
                return false;
            }
            return !!groupValues[ta.id] && groupValues[ta.id] !== 'Select one';
        });
    }

    const search = (keyword) => {
        if (keyword && keyword.length > 0) {
            const entities = searchEntities(keyword, allEntities, nameAttributes);
            setEntities(entities);
        } else {
            setEntities(allEntities);
        }
    }

    const filterDataValuesInStage = (stage, dataValues) => {
        const dataElements = stageDataElements.find(sde => sde.stage === stage)?.dataElements;
        return filterDataValues(dataElements, dataValues).filter(dv => dv.dataElement && dv.dataElement.length > 0);
    }

    const updateAttributes = async () => {
        const training = events.find(evt => evt.trackedEntity === selectedTraining);
        if (training) {
            const activity = training.attributes.find(attr => attr.attribute === EVENT_OPTIONS.attributes.activity);
            const name = training.attributes.find(attr => attr.attribute === EVENT_OPTIONS.attributes.event).value;

            if (training && activity) {
                let selectedStage = '';
                switch (+activity.value) {
                    case 1:
                        selectedStage = ACTIVITY_STAGE_MAPPING[1];
                        break;
                    case 2:
                        selectedStage = ACTIVITY_STAGE_MAPPING[2];
                        break;
                    case 3:
                        selectedStage = ACTIVITY_STAGE_MAPPING[3];
                        break;
                    default:
                        selectedStage = ACTIVITY_STAGE_MAPPING[1];
                }
                const nameAttribute = EVENT_OPTIONS.stageMapping.find(sm => sm.id === selectedStage).mappings[EVENT_OPTIONS.attributes.event];
                const attributes = Object.keys(groupValues).map(key => {
                    const mapping = EVENT_OPTIONS.stageMapping.find(sm => sm.id === selectedStage);
                    if (key === EVENT_OPTIONS.attributes.days) {
                        return {
                            dataElement: mapping.mappings[key],
                            value: daysBetween(new Date(groupDataElementValue(EVENT_OPTIONS.attributes.startDate)), new Date(groupDataElementValue(EVENT_OPTIONS.attributes.endDate)))
                        }
                    }
                    return {
                        dataElement: mapping.mappings[key],
                        value: groupValues[key]
                    }
                });

                const attendees = training.relationships.map(rel => rel.from.trackedEntity.trackedEntity);
                const values = await fetchEntities(engine, attendees, '*');
                const modifiedParticipants = values.map(participant => {
                    participant.entity.enrollments = participant.entity.enrollments.map(enrollment => {
                        enrollment.events = enrollment.events.map(evt => {
                            const match = evt.dataValues?.some(d => {
                                return d.dataElement === nameAttribute && d.value === name;

                            })
                            if (match) {
                                attributes.forEach(de => {
                                    const dataValue = evt.dataValues.find(dv => dv.dataElement === de.dataElement) || {};
                                    dataValue.dataElement = de.dataElement;
                                    dataValue.value = de.value;

                                    const dataValues = evt.dataValues.filter(dv => dv.dataElement !== de.dataElement) || [];
                                    dataValues.push(dataValue);
                                    evt.dataValues = dataValues;
                                })
                            }
                            evt.dataValues = filterDataValuesInStage(evt.programStage, evt.dataValues);

                            return evt;
                        });
                        return enrollment;
                    })
                    return participant.entity;
                });

                setSaving(true);
                trackerCreate(engine, {
                    trackedEntities: modifiedParticipants
                }).then(_ => setSaving(false))
            }
        }
    }

    const renameOption = async (oldName, newName) => {
        const splitUniqueName = (uniqueName) => {
            // Use a regular expression to split the string at the last two underscores
            const lastUnderscoresIndex = uniqueName.lastIndexOf('_');
            const secondLastUnderscoresIndex = uniqueName.lastIndexOf('_', lastUnderscoresIndex - 1);

            if (lastUnderscoresIndex === -1 || secondLastUnderscoresIndex === -1) {
                console.error('Invalid format: Unique name must include name_startdate_enddate');
            }

            // Extract the parts
            const namePart = uniqueName.substring(0, secondLastUnderscoresIndex);
            const datePart = uniqueName.substring(secondLastUnderscoresIndex + 1);

            return {name: namePart, dates: datePart};
        }
        const trainings = allTrainings.filter(training => {
            const uniqueName = training.attributes?.find(attr => attr.attribute === EVENT_OPTIONS.attributes.uniqueName);
            return uniqueName && splitUniqueName(uniqueName.value)?.name === oldName;
        });

        const attendees = trainings.flatMap(training => {
            return {
                entities: training.relationships.map(rel => rel.from.trackedEntity.trackedEntity),
                uniqueName: training.attributes.find(attr => attr.attribute === EVENT_OPTIONS.attributes.uniqueName)?.value
            }
        });

        const renamedTrainings = trainings.map(training => {
            return ({
                ...training,
                ['attributes']: training.attributes.map(attr => {
                    if (attr.attribute === EVENT_OPTIONS.attributes.uniqueName) {
                        attr.value = `${newName}_${splitUniqueName(attr.value).dates}`
                    }
                    return attr;
                }),
                ['enrollments']: training.enrollments.map(en => {
                    en.attributes = en.attributes.map(attr => {
                        if (attr.attribute === EVENT_OPTIONS.attributes.uniqueName) {
                            attr.value = `${newName}_${splitUniqueName(attr.value).dates}`
                        }
                        return attr;
                    })
                    return en;
                })
            });
        });

        if (attendees.length > 0) {
            const distinct = new Set(attendees.flatMap(a => a.entities));
            const values = await fetchEntities(engine, Array.from(distinct), '*');
            const modifiedParticipants = values.map(participant => {
                participant.entity.enrollments = participant.entity.enrollments.map(enrollment => {
                    enrollment.events = enrollment.events.map(evt => {
                        evt.dataValues = filterDataValuesInStage(evt.programStage, evt.dataValues);

                        const mapping = EVENT_OPTIONS.stageMapping.find(sm => sm.id === evt.programStage);
                        const uniqueName = mapping.mappings[EVENT_OPTIONS.attributes.uniqueName];
                        const mappings = attendees.filter(m => m.entities.includes(participant.entity.trackedEntity));
                        mappings.forEach(m => {
                            evt.dataValues = evt.dataValues.map(attr => {
                                if (attr.dataElement === uniqueName && m.uniqueName === attr.value) {
                                    attr.value = `${newName}_${splitUniqueName(attr.value).dates}`
                                }
                                return attr;
                            });
                        });
                        evt.dataValues = filterDataValuesInStage(evt.programStage, evt.dataValues);
                        return evt;
                    });
                    return enrollment;
                })
                return participant.entity;
            });
            renamedTrainings.push(...modifiedParticipants);
        }

        setSaving(true);
        trackerCreate(engine, {
            trackedEntities: renamedTrainings
        }).then(_ => setSaving(false))
    }

    const downloadAttendance = async () => {
        prepareAndDownloadAttendance(participants, orgUnits, nameAttributes);
    }

    return (!(selectedSharedIsMEL || selectedSharedIsAdmin)) ? <NotFoundPage/> : (
        <>
            <div className="flex flex-row w-full h-full">
                <div className="page">
                    <Navigation/>
                    <div className="p-6">
                        <div className="mx-auto w-full">
                            <div className="w-full">
                                <div className="flex flex-col">
                                    <div className="flex flex-col w-full mb-2">
                                        <div className="w-full flex flex-row pt-2 gap-x-1">
                                            <div className="w-full flex flex-col card gap-x-1">
                                                <div className="w-3/12 p-3">
                                                    <label htmlFor="stage"
                                                           className="label">
                                                        {i18n.t('Event Venue')}
                                                    </label>
                                                    <div className="border border-blue-500 mb-2">
                                                        <label className="label pl-2 pt-2 text-sm italic">
                                                            Select a venue to begin configuring an event
                                                        </label>
                                                    </div>
                                                    <VenueComponent
                                                        venueSelected={(venue) => setVenue(venue)}/>
                                                </div>
                                                {selectedVenue &&
                                                    <div
                                                        className="w-full p-8 mt-6 lg:mt-0 rounded shadow bg-white border-t-2 border-blue-500">
                                                        <div
                                                            className="relative overflow-x-auto shadow-md sm:rounded-lg w-full">
                                                            <div
                                                                className="flex flex-row gap-x-2 m-2 border-b-2 border-blue-500">
                                                                <div className="flex items-center mb-4">
                                                                    <input type="radio"
                                                                           checked={editMode === false}
                                                                           name="mode"
                                                                           onClick={() => {
                                                                               setEditMode(false);
                                                                               setGroupValues(Object.assign({}));
                                                                               setParticipants([]);
                                                                           }}
                                                                           className="radio"/>
                                                                    <label htmlFor="default-radio-1"
                                                                           className="label pl-2 pt-2">
                                                                        Configure New Event
                                                                    </label>
                                                                </div>
                                                                <div className="flex items-center mb-4">
                                                                    <input type="radio"
                                                                           name="mode"
                                                                           checked={editMode === true}
                                                                           onClick={() => {
                                                                               setEditMode(true);
                                                                               setGroupValues(Object.assign({}));
                                                                               setSelectedTraining('');
                                                                               setParticipants([]);
                                                                           }}
                                                                           className="radio"/>
                                                                    <label htmlFor="default-radio-2"
                                                                           className="label pl-2 pt-2">
                                                                        Update Existing Event
                                                                    </label>
                                                                </div>
                                                            </div>
                                                            {(trainingAttributes || []).length > 0 && selectedVenue &&
                                                                <div className="flex flex-row justify-end">
                                                                    {selectedTraining && editMode &&
                                                                        <button type="button"
                                                                                disabled={deleting || loading}
                                                                                className={(deleting || loading) ? 'warn-btn-disabled' : 'warn-btn'}
                                                                                onClick={() => setConfirmShow(true)}>
                                                                            <div
                                                                                className="flex flex-row">
                                                                                {deleting &&
                                                                                    <div
                                                                                        className="pr-2">
                                                                                        <SpinnerComponent/>
                                                                                    </div>
                                                                                }
                                                                                <span>Delete Event</span>
                                                                            </div>
                                                                        </button>
                                                                    }
                                                                    <button type="button"
                                                                            onClick={() => {
                                                                                saveTraining()
                                                                            }}
                                                                            disabled={saving || loading || !validateTraining() || invalid}
                                                                            className={loading || saving || !validateTraining() || invalid ? 'primary-btn-disabled' : 'primary-btn'}
                                                                    >
                                                                        <div
                                                                            className="flex flex-row">
                                                                            {(saving || loading) &&
                                                                                <div
                                                                                    className="pr-2">
                                                                                    <SpinnerComponent/>
                                                                                </div>
                                                                            }
                                                                            <span>{editMode ? 'Update Event' : 'Create New Event'}</span>
                                                                        </div>
                                                                    </button>
                                                                </div>
                                                            }
                                                            <div className="flex flex-col w-4/12">
                                                                {selectedVenue && editMode &&
                                                                    <div className="w-full p-2">
                                                                        <label htmlFor="program"
                                                                               className="label">
                                                                            Existing Events
                                                                        </label>
                                                                        <SingleSelectField
                                                                            className="w-full"
                                                                            selected={selectedTraining}
                                                                            clearable={true}
                                                                            filterable={true}
                                                                            placeholder={'Select event'}
                                                                            onChange={(event) => {
                                                                                setSelectedTraining(event.selected);
                                                                            }}>
                                                                            {trainings.sort((o1, o2) => o1.label.localeCompare(o2.label)).map(option => (
                                                                                    <SingleSelectOption
                                                                                        label={option.label}
                                                                                        value={option.id}>
                                                                                    </SingleSelectOption>
                                                                                )
                                                                            )}
                                                                        </SingleSelectField>
                                                                    </div>
                                                                }
                                                                {selectedVenue && ((editMode && selectedTraining) || !editMode) &&
                                                                    <>
                                                                        <DataElementsComponent data={memoizedData}
                                                                                               disable={disable}
                                                                                               editOnly={editMode}
                                                                                               required={true}
                                                                                               configuredCondition={configuredCondition}
                                                                                               setInvalid={(invalid) => setInvalid(invalid)}
                                                                                               setEditingOption={(editing) => setDisable(editing)}
                                                                                               valueChange={createOrUpdateGroupEvent}
                                                                                               optionRenamed={(oldName, newName) => renameOption(oldName, newName)}/>

                                                                        <div className="card">
                                                                            <label className="label">
                                                                                {i18n.t('Event Facilitator(s)')}
                                                                            </label>
                                                                            <Transfer options={users}
                                                                                      selected={facilitators}
                                                                                      filterable={true}
                                                                                      leftHeader={<div
                                                                                          className="p-2 font-semibold">Available
                                                                                          Users</div>}
                                                                                      rightHeader={<div
                                                                                          className="p-2 font-semibold">Facilitator(s)</div>}
                                                                                      onChange={(payload) => {
                                                                                          setFacilitators(payload.selected);
                                                                                      }}
                                                                                      enableOrderChange
                                                                            />
                                                                        </div>
                                                                    </>
                                                                }
                                                            </div>
                                                            {(trainingAttributes || []).length > 0 && selectedVenue &&
                                                                <div className="flex flex-row justify-end">
                                                                    {selectedTraining && editMode &&
                                                                        <button type="button"
                                                                                disabled={deleting || loading}
                                                                                className={(deleting || loading) ? 'warn-btn-disabled' : 'warn-btn'}
                                                                                onClick={() => setConfirmShow(true)}>
                                                                            <div
                                                                                className="flex flex-row">
                                                                                {deleting &&
                                                                                    <div
                                                                                        className="pr-2">
                                                                                        <SpinnerComponent/>
                                                                                    </div>
                                                                                }
                                                                                <span>Delete Event</span>
                                                                            </div>
                                                                        </button>
                                                                    }
                                                                    <button type="button"
                                                                            onClick={() => {
                                                                                saveTraining();
                                                                            }}
                                                                            disabled={saving || loading || !validateTraining() || invalid}
                                                                            className={loading || saving || !validateTraining() || invalid ? 'primary-btn-disabled' : 'primary-btn'}
                                                                    >
                                                                        <div
                                                                            className="flex flex-row">
                                                                            {(saving || loading) &&
                                                                                <div
                                                                                    className="pr-2">
                                                                                    <SpinnerComponent/>
                                                                                </div>
                                                                            }
                                                                            <span>{editMode ? 'Update Event' : 'Create New Event'}</span>
                                                                        </div>
                                                                    </button>
                                                                </div>
                                                            }
                                                        </div>
                                                    </div>
                                                }
                                            </div>
                                        </div>
                                        {participants && selectedVenue &&
                                            <div className="w-full flex flex-col pt-2">
                                                <div
                                                    className={loading ? 'opacity-20 relative overflow-x-auto shadow-md sm:rounded-l' : 'relative overflow-x-auto shadow-md sm:rounded-l'}>
                                                    {loading &&
                                                        <SpinnerComponent/>
                                                    }
                                                    <div className="flex flex-row justify-end">
                                                        {participants.length > 0 && allParticipantsInTraining() &&
                                                            <button type="button"
                                                                    onClick={downloadAttendance}
                                                                    className="primary-btn"
                                                            >
                                                                Download attendance
                                                            </button>
                                                        }
                                                    </div>
                                                    <table
                                                        className="w-full text-sm text-left rtl:text-right text-gray-500 ">
                                                        <caption
                                                            className="p-5 text-lg font-semibold text-left rtl:text-right text-gray-900 bg-white ">

                                                            <p className="mt-1 text-sm font-normal text-gray-500 ">
                                                                Training /Workshop participants
                                                            </p>
                                                        </caption>
                                                        <thead
                                                            className="text-xs text-gray-700 uppercase bg-gray-50 ">
                                                        <tr>
                                                            <th data-priority="1"
                                                                className="px-6 py-3 w-1/12">#
                                                            </th>
                                                            <th data-priority="2"
                                                                className="px-6 py-3 w-6/12">Profile
                                                            </th>
                                                            <th data-priority="2"
                                                                className="px-6 py-3 w-3/12">Org Unit
                                                            </th>
                                                            <th className="w-2/12"></th>
                                                        </tr>
                                                        </thead>
                                                        <tbody>
                                                        {pagedParticipants.map((entity, index) => {
                                                            return <>
                                                                <tr className="pr-3 text-right odd:bg-white  even:bg-gray-50  border-b ">
                                                                    <td>{index + 1}</td>
                                                                    <td className="text-left px-6 py-4 font-medium text-gray-900 whitespace-nowrap ">{getParticipant(entity, nameAttributes)}</td>
                                                                    <td className="text-left px-6 py-4 font-medium text-gray-900 whitespace-nowrap ">{orgUnits.find(ou => ou.id === entity.orgUnit)?.displayName}</td>
                                                                    <td>
                                                                        <button type="button"
                                                                                className="warn-btn"
                                                                                onClick={() => {
                                                                                    removeParticipant(entity)
                                                                                }}>Remove
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            </>
                                                        })}
                                                        </tbody>
                                                        <tfoot>
                                                        <tr>
                                                            <th className="w-full p-2" colSpan={4}>
                                                                <div
                                                                    className="flex flex-row w-full justify-end">
                                                                    <Pagination
                                                                        page={participantsPage}
                                                                        pageSize={participantPageSize}
                                                                        pageCount={Math.ceil(participants.length / participantPageSize)}
                                                                        total={participants.length}
                                                                        onPageChange={(page) => pageParticipants(page)}
                                                                        onPageSizeChange={(size) => {
                                                                            setParticipantsPage(1);
                                                                            setParticipantPageSize(size);
                                                                            pageParticipants(1, size);
                                                                        }}
                                                                    />
                                                                </div>
                                                            </th>
                                                        </tr>
                                                        </tfoot>
                                                    </table>
                                                </div>
                                            </div>
                                        }
                                        {selectedVenue &&
                                            <div className="w-full flex flex-row pt-2">
                                                <div className="w-3/12 p-2 mt-2 mb-2 bg-white">
                                                    <div className="border border-blue-500 mb-2">
                                                        <label className="label pl-2 pt-2 text-sm italic">
                                                            Select an Org Unit to get potential attendees
                                                        </label>
                                                    </div>
                                                    <OrganisationUnitComponent
                                                        handleOUChange={orgUnitChanged}
                                                        selectedOU={selectedOu}
                                                    />
                                                </div>
                                                <div className="w-9/12 p-2">
                                                    <div className="p-8 mt-6 lg:mt-0 rounded shadow bg-white">
                                                        <div
                                                            className={loadingEntities ? 'opacity-20 relative overflow-x-auto shadow-md sm:rounded-l' : 'relative overflow-x-auto shadow-md sm:rounded-l'}>
                                                            {loadingEntities &&
                                                                <SpinnerComponent/>
                                                            }
                                                            {orgUnit &&
                                                                <div className="w-3/12">
                                                                    <SearchComponent search={(value) => search(value)}/>
                                                                </div>
                                                            }
                                                            <table
                                                                className="w-full text-sm text-left rtl:text-right text-gray-500 0">
                                                                <caption
                                                                    className="p-5 text-lg font-semibold text-left rtl:text-right text-gray-900 bg-white d">

                                                                    <p className="mt-1 text-sm font-normal text-gray-500 ">

                                                                    </p>
                                                                    {selectedEntities.length > 0 &&
                                                                        <button type="button"
                                                                                className="primary-btn"
                                                                                onClick={addSelection}>Add
                                                                            Attendee(s)
                                                                        </button>
                                                                    }
                                                                </caption>
                                                                <thead
                                                                    className="text-xs text-gray-700 uppercase bg-gray-50 ">
                                                                <tr>
                                                                    <th className="px-6 py-6 w-1/12">
                                                                        <div
                                                                            className="flex items-center mb-4">
                                                                            <input
                                                                                type="checkbox"
                                                                                onChange={(event) => {
                                                                                    if (event.target.checked) {
                                                                                        setSelectedEntities(entities)
                                                                                    } else {
                                                                                        setSelectedEntities([])
                                                                                    }
                                                                                }}
                                                                                checked={selectedEntities?.length === entities?.length}
                                                                                className="checkbox"/>
                                                                        </div>
                                                                    </th>
                                                                    <th data-priority="1"
                                                                        className="px-6 py-3 w-1/12">#
                                                                    </th>
                                                                    <th data-priority="2"
                                                                        className="px-6 py-3 w-6/12">Profile
                                                                    </th>
                                                                    <th className="px-6 py-3 w-2/12">ID Number</th>
                                                                    <th data-priority="2"
                                                                        className="px-6 py-3 w-4/12">Org Unit
                                                                    </th>
                                                                </tr>
                                                                </thead>
                                                                <tbody>
                                                                {entities?.map((entity, index) => {
                                                                    return <>
                                                                        <tr className="pr-3 text-right odd:bg-white  even:bg-gray-50  border-b d">
                                                                            <td className="px-6 py-6">
                                                                                <div
                                                                                    className="flex items-center mb-4">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={selectedEntities.map(e => e.trackedEntity).includes(entity.trackedEntity)}
                                                                                        onChange={() => {
                                                                                            if (selectedEntities.map(e => e.trackedEntity).includes(entity.trackedEntity)) {
                                                                                                setSelectedEntities(selectedEntities.filter(rowId => rowId.trackedEntity !== entity.trackedEntity));
                                                                                            } else {
                                                                                                setSelectedEntities([...selectedEntities, entity]);
                                                                                            }
                                                                                        }}
                                                                                        className="checkbox"/>
                                                                                </div>
                                                                            </td>
                                                                            <td>{index + 1}</td>
                                                                            <td className="text-left px-6 py-4 font-medium text-gray-900 whitespace-nowrap ">{getParticipant(entity, nameAttributes)}</td>
                                                                            <td className="text-left px-6 py-4 font-medium text-gray-900 whitespace-nowrap ">{getParticipant(entity, ['Bj48LXj8FmH'])}</td>
                                                                            <td className="text-left px-6 py-4 font-medium text-gray-900 whitespace-nowrap ">{orgUnits.find(ou => ou.id === entity.orgUnit)?.displayName}</td>
                                                                        </tr>
                                                                    </>
                                                                })}
                                                                </tbody>
                                                                <tfoot>
                                                                <tr>
                                                                    <th className="w-full p-2" colSpan={4}>
                                                                        <div
                                                                            className="flex flex-row w-full justify-end">
                                                                            <Pagination
                                                                                page={page}
                                                                                pageSize={pageSize}
                                                                                pageCount={Math.ceil(totalEntities / pageSize)}
                                                                                total={totalEntities}
                                                                                onPageChange={(page) => {
                                                                                    setPage(page);
                                                                                    setLoadingEntities(true);
                                                                                }}
                                                                                onPageSizeChange={(size) => {
                                                                                    setPageSize(size);
                                                                                    setLoadingEntities(true);
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    </th>
                                                                </tr>
                                                                </tfoot>
                                                            </table>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        }
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <Modal hide={!confirmShow}>
                <ModalTitle>Delete Event</ModalTitle>

                <ModalContent>
                    Click ok to delete event. The process is not reversible
                </ModalContent>

                <ModalActions>
                    <button type="button"
                            className="py-2.5 px-5 me-2 mb-2 text-sm font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-gray-100"
                            onClick={() => {
                                setConfirmShow(false);
                            }}>
                        Cancel
                    </button>

                    <button type="button"
                            className="text-white bg-red-700 hover:bg-red-800 focus:ring-4 focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 focus:outline-none"
                            onClick={() => {
                                setConfirmShow(false);
                                deleteEvent();
                            }}>
                        Delete
                    </button>
                </ModalActions>
            </Modal>
        </>
    )
}
