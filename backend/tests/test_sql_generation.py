from types import SimpleNamespace
from uuid import uuid4

from app.services.sql_generation import build_create_table_sql, build_migration_sql, infer_sql_type


def _column(
    path: str,
    *,
    data_type: str,
    example_value: str | None,
    is_nullable: bool = True,
    is_array: bool = False,
    is_object: bool = False,
    maximum_length: int | None = None,
):
    statistics = None if maximum_length is None else SimpleNamespace(maximum_length=maximum_length)
    return SimpleNamespace(
        id=uuid4(),
        column_path=path,
        data_type=data_type,
        example_value=example_value,
        is_nullable=is_nullable,
        is_array=is_array,
        is_object=is_object,
        statistics=statistics,
    )


def _version(number: int, columns: list[object]):
    return SimpleNamespace(id=uuid4(), version_number=number, columns=columns)


def _connection(name: str = "Employee Profile API"):
    return SimpleNamespace(name=name)


def test_infer_sql_type_maps_supported_types():
    assert infer_sql_type(_column("active", data_type="boolean", example_value="True")) == "BOOLEAN"
    assert infer_sql_type(_column("joined_on", data_type="string", example_value="2026-07-25")) == "DATE"
    assert infer_sql_type(_column("updated_at", data_type="string", example_value="2026-07-25T10:30:45Z")) == "TIMESTAMP"
    assert infer_sql_type(_column("salary", data_type="number", example_value="1200.50")) == "NUMERIC"
    assert infer_sql_type(_column("payload", data_type="object", example_value='{"a":1}', is_object=True)) == "JSONB"
    assert infer_sql_type(_column("name", data_type="string", example_value="Ava", maximum_length=120)) == "VARCHAR(120)"


def test_build_create_table_sql_generates_table_definition():
    schema_version = _version(
        3,
        [
            _column("employee.name", data_type="string", example_value="Ava", is_nullable=False, maximum_length=80),
            _column("employee.joined_on", data_type="string", example_value="2026-07-25"),
            _column("employee.metadata", data_type="object", example_value='{"department":"HR"}', is_object=True),
            _column("employee.tags[]", data_type="string", example_value="tag", is_array=True),
        ],
    )

    sql = build_create_table_sql(_connection(), schema_version)

    assert 'CREATE TABLE "employee_profile_api"' in sql
    assert '"name" VARCHAR(80) NOT NULL' in sql
    assert '"joined_on" DATE' in sql
    assert '"metadata" JSONB' in sql
    assert '"tags"' not in sql


def test_build_migration_sql_generates_add_alter_and_drop():
    from_version = _version(
        1,
        [
            _column("employee.name", data_type="string", example_value="Ava", maximum_length=80),
            _column("employee.age", data_type="integer", example_value="30"),
            _column("employee.legacy", data_type="string", example_value="old", maximum_length=20),
        ],
    )
    to_version = _version(
        2,
        [
            _column("employee.name", data_type="string", example_value="Ava", maximum_length=120),
            _column("employee.age", data_type="integer|string", example_value="30 years"),
            _column("employee.title", data_type="string", example_value="Manager", maximum_length=50),
        ],
    )

    sql = build_migration_sql(_connection(), from_version, to_version, "employees")

    assert 'ALTER TABLE "employees" ADD COLUMN "title" VARCHAR(50);' in sql
    assert 'ALTER TABLE "employees" DROP COLUMN "legacy";' in sql
    assert 'ALTER TABLE "employees" ALTER COLUMN "age" TYPE VARCHAR(255);' in sql or 'ALTER TABLE "employees" ALTER COLUMN "age" TYPE VARCHAR(64);' in sql or 'ALTER TABLE "employees" ALTER COLUMN "age" TYPE VARCHAR(8);' in sql
