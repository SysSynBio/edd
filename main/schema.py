import graphene

from graphene import relay, ObjectType, AbstractType
from graphene_django import DjangoObjectType
from graphene_django.filter import DjangoFilterConnectionField

from main.models import Study, Line, Assay, Measurement, MeasurementUnit, Strain
from .redis import LatestViewedStudies


# class StudyNode(DjangoObjectType):
#     class Meta:
#         model = Study
#         filter_fields = {
#             'name': ['exact', 'istartswith'],
#             'id': ['exact']
#         }
#         interfaces = (relay.Node, )
#
#
# class LineNode(DjangoObjectType):
#     class Meta:
#         model = Line
#
#         filter_fields = {
#             'name': ['exact', 'icontains', 'istartswith'],
#             'strains': ['exact', 'icontains'],
#             'study': ['exact'],
#             'study__name': ['exact','icontains'],
#         }
#         interfaces = (relay.Node, )
#
#
# class AssayNode(DjangoObjectType):
#     class Meta:
#         model = Assay
#         filter_fields = ['name', 'id']
#         interfaces = (relay.Node, )
#
#
# class MeasurementNode(DjangoObjectType):
#     class Meta:
#         model = Measurement
#         filter_fields = ['id']
#         interfaces = (relay.Node,)
#
#
# class MeasurementUnitNode(DjangoObjectType):
#     class Meta:
#         model = MeasurementUnit
#         filter_fields = ['id']
#         interfaces = (relay.Node,)
#
#
# class StrainNode(DjangoObjectType):
#     class Meta:
#         model = Strain
#         filter_fields = ['id', 'line__name']
#         interfaces = (relay.Node,)
#
#
# class Query(AbstractType):
#     study = relay.Node.Field(StudyNode)
#     all_studies = DjangoFilterConnectionField(StudyNode)
#
#     line = relay.Node.Field(LineNode)
#     all_lines = DjangoFilterConnectionField(LineNode)
#
#     assay = relay.Node.Field(AssayNode)
#     all_assays = DjangoFilterConnectionField(AssayNode)
#
#     measurement = relay.Node.Field(MeasurementNode)
#     all_measurements = DjangoFilterConnectionField(MeasurementNode)
#
#     measurement_unit = relay.Node.Field(MeasurementUnitNode)
#     all_measurement_units = DjangoFilterConnectionField(MeasurementUnitNode)
#
#     strain = relay.Node.Field(StrainNode)
#     all_strains = DjangoFilterConnectionField(StrainNode)


class StudyType(DjangoObjectType):
    class Meta:
        model = Study


class LineType(DjangoObjectType):
    class Meta:
        model = Line


class AssayType(DjangoObjectType):
    class Meta:
        model = Assay


class MeasurementType(DjangoObjectType):
    class Meta:
        model = Measurement


class MeasurementUnitType(DjangoObjectType):
    class Meta:
        model = MeasurementUnit


class StrainType(DjangoObjectType):
    class Meta:
        model = Strain

class Query(AbstractType):
    study = graphene.Field(StudyType,
                           id=graphene.Int())
    all_studies = graphene.List(StudyType)

    line = graphene.Field(LineType,
                          id=graphene.Int()
                          )
    all_lines = graphene.List(LineType)

    assay = graphene.Field(AssayType,
                          id=graphene.Int()
                          )
    all_assays = graphene.List(AssayType)

    all_measurements = graphene.List(MeasurementType)

    all_measurement_types = graphene.List(MeasurementUnitType)

    measurement_type = graphene.Field(MeasurementUnitType,
                          id=graphene.Int()
                          )

    all_strains = graphene.List(StrainType)

    strain_type = graphene.Field(StrainType,
                                 id=graphene.Int())

    def resolve_all_studies(self, args, context, info):
        return Study.objects.all()

    def resolve_latest_viewed_studies(self, args, context, info):
        redis = LatestViewedStudies(self.user)
        return Study.objects.filter(pk__in=redis)

    def resolve_all_lines(self, args, context, info):
        # We can easily optimize query count in the resolve method
        return Line.objects.select_related('study, strains').all()

    def resolve_all_assays(self, args, context, info):
        # We can easily optimize query count in the resolve method
        return Assay.objects.select_related('line, measurement_types').all()

    def resolve_all_measurements(self, args, context, info):
        # We can easily optimize query count in the resolve method
        return Measurement.objects.select_related('assay').all()

    def resolve_all_measurement_units(self, args, context, info):
        # We can easily optimize query count in the resolve method
        return MeasurementUnit.objects.all()

    def resolve_all_strains(self, args, context, info):
        return Strain.objects.all()

    def resolve_study(self, args, context, info):
        id = args.get('id')

        if id is not None:
            return Study.objects.get(pk=id)

        return None

    def resolve_line(self, args, context, info):
        id = args.get('id')

        if id is not None:
            return Line.objects.get(pk=id)

        return None

    def resolve_assay(self, args, context, info):
        id = args.get('id')

        if id is not None:
            return Assay.objects.get(pk=id)

        return None

    def resolve_measurement_unit(self, args, context, info):
        id = args.get('id')

        if id is not None:
            return MeasurementUnit.objects.get(pk=id)

        return None


    def resolve_strain(self, args, context, info):
        id = args.get('id')

        if id is not None:
            return Strain.objects.get(pk=id)

        return None
